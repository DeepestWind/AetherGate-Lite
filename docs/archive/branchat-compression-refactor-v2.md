# Branchat 上下文压缩重构方案 v2

## 现有问题

当前压缩实现存在一个根本性缺陷：**压缩操作直接修改节点的 `parent_id` 并标记 `archived`（`chat_sessions.py line 809`），导致共享该节点的其他分支在 flatten 和 UI 中断路。**

具体表现：

1. `flatten` 过滤 `archived` 节点（`chat_sessions.py line 239`），若共享祖先被压缩标记为 `archived`，依赖它的其他分支 flatten 结果将缺失该节点之前的所有上下文。
2. 前端树面板同样过滤 `archived` 节点（`conversation-tree-panel.tsx line 18`），共享祖先在 UI 上消失，分支显示断裂。
3. 前端主消息区目前从 `message_nodes + branch.head` 重建消息列表（`chat-adapters.ts line 275/320`），虚拟 summary 节点不在 `message_nodes` 里将不会渲染。

---

## 改进核心思路

**原始树结构只读，压缩结果作为分支级缓存独立存储。**

- `node_store` 中所有节点的 `parent_id` 永远不被压缩逻辑修改
- 压缩产生的 summary 不插入原始树，存入该分支的 `compressed_path` 缓存字段
- flatten 时优先使用缓存，缓存失效时回退原始 `parent_id` 链路
- 各分支缓存完全独立，共享祖先问题从根本上消失
- 前端主消息区改为信后端返回的 `messages`，树面板继续基于原始 `message_nodes` 渲染

---

## 数据结构改动

### ChatMessageRecord（后端消息节点）

新增 `version` 字段，**保留 `archived` 字段不删除**（现有代码多处依赖，待全链路切干净后再清理）：

```python
class ChatMessageRecord:
    id: str
    role: str            # "user" | "assistant" | "summary"
    content: str
    parent_id: str
    modified_from: str | None
    pinned: bool
    stale: bool
    archived: bool       # 保留，新压缩流程不再写入此字段
    version: int = 0     # 新增，content 每次被修改时递增，初始为 0
```

> `version` 的作用：content 被修改时递增，供缓存失效检测使用。新压缩流程**不再修改任何节点的 `parent_id`，也不再写入 `archived`**。

---

### ChatBranch（后端分支记录）

新增三个字段：

```python
class ChatBranch:
    head_message_id: str                          # 当前叶节点 id（原有）
    base_message_id: str                          # 分支起点（原有）

    compressed_path_json: str | None = None
    # 序列化的压缩路径，格式见下方 CachedPathEntry
    # None 表示无缓存，直接走原始链路

    compressed_at_head_message_id: str | None = None
    # 生成缓存时的叶节点 id
    # 与当前 head_message_id 不一致时缓存视为过期

    compressed_source_versions_json: str | None = None
    # 被压缩段的节点版本快照，格式：{"node_id": version, ...}
    # 用于检测被压缩段的节点是否被事后编辑
```

数据库迁移：给 `chat_branches` 表新增以上三个 JSON/TEXT 字段，默认值均为 NULL。

---

### CachedPathEntry（缓存路径条目，不落库，序列化存入 compressed_path_json）

```python
class CachedPathEntry:
    node_id: str     # 对应节点的 id，summary 条目为空字符串
    role: str        # "user" | "assistant" | "summary"
    content: str     # 消息内容，summary 条目为摘要文本
    version: int     # 记录缓存时该节点的 version，summary 条目为 0
```

---

## 核心函数实现

### 1. flatten

```python
def flatten(branch: ChatBranch) -> list[dict]:
    """
    返回当前分支的完整上下文列表，供 API 调用使用。
    优先使用缓存，缓存失效时回退原始链路。
    """

    # 无缓存
    if not branch.compressed_path_json:
        return walk_parent_chain(branch.head_message_id)

    # 缓存过期（叶节点已变化）
    if branch.compressed_at_head_message_id != branch.head_message_id:
        return walk_parent_chain(branch.head_message_id)

    cached_path = json.loads(branch.compressed_path_json)

    # survivor 节点 version 校验
    if not survivors_valid(cached_path):
        invalidate_cache(branch)
        return walk_parent_chain(branch.head_message_id)

    # 被压缩段 version 校验（防御性，防止被压缩节点被事后编辑）
    if branch.compressed_source_versions_json:
        source_versions = json.loads(branch.compressed_source_versions_json)
        if not sources_valid(source_versions):
            invalidate_cache(branch)
            return walk_parent_chain(branch.head_message_id)

    return [{"role": e["role"], "content": e["content"]} for e in cached_path]


def walk_parent_chain(node_id: str) -> list[dict]:
    path = []
    current = node_store.get(node_id)
    while current:
        path.append({"role": current.role, "content": current.content})
        current = node_store.get(current.parent_id)
    return list(reversed(path))


def survivors_valid(cached_path: list[dict]) -> bool:
    for entry in cached_path:
        if not entry["node_id"]:
            continue  # summary 虚拟条目跳过
        node = node_store.get(entry["node_id"])
        if node and node.version != entry["version"]:
            return False
    return True


def sources_valid(source_versions: dict) -> bool:
    for node_id, cached_version in source_versions.items():
        node = node_store.get(node_id)
        if node and node.version != cached_version:
            return False
    return True


def invalidate_cache(branch: ChatBranch):
    branch.compressed_path_json = None
    branch.compressed_at_head_message_id = None
    branch.compressed_source_versions_json = None
```

---

### 2. prepare_context（发送前压缩检测）

在 flatten 之后、调用 API 之前执行：

```python
def prepare_context(branch: ChatBranch) -> list[dict]:
    window_size = get_model_window_size()
    tier = get_tier(window_size)

    context = flatten(branch)
    total_tokens = estimate_tokens(context)

    if total_tokens < window_size * tier.trigger_ratio:
        return context

    # 超阈值，触发压缩，更新缓存后重新 flatten
    compress(branch, tier)
    return flatten(branch)
```

---

### 3. compress（只操作分支缓存，不改原始树）

```python
def compress(branch: ChatBranch, tier: Tier):
    """
    压缩当前分支的上下文，结果写入分支缓存。
    不修改任何节点的 parent_id，不写入 archived。
    """

    full_path = walk_parent_chain_as_nodes(branch.head_message_id)
    # full_path: 从根到叶的完整节点对象列表

    # 分离 pinned 节点和可压缩节点
    pinned = [n for n in full_path if n.pinned]
    compressible = [n for n in full_path if not n.pinned]

    if len(compressible) < 2:
        return  # 可压缩节点不足，不执行

    # 确定压缩范围
    cut = int(len(compressible) * tier.compress_ratio)
    to_compress = compressible[:cut]
    survivors = compressible[cut:]

    if not to_compress:
        return

    # 生成摘要
    summary_text = call_summary_api(
        [{"role": n.role, "content": n.content} for n in to_compress]
    )

    # 构建缓存路径
    pinned_entries = [
        {"node_id": n.id, "role": n.role, "content": n.content, "version": n.version}
        for n in pinned
        if full_path.index(n) < full_path.index(compressible[0])
        # 只保留位于压缩段之前的 pinned 节点
    ]

    summary_entry = {
        "node_id": "",           # 虚拟条目
        "role": "summary",
        "content": summary_text,
        "version": 0
    }

    survivor_entries = [
        {"node_id": n.id, "role": n.role, "content": n.content, "version": n.version}
        for n in survivors
    ]

    # 被压缩段的版本快照（用于防御性校验）
    source_versions = {n.id: n.version for n in to_compress}

    # 写入分支缓存
    branch.compressed_path_json = json.dumps(pinned_entries + [summary_entry] + survivor_entries)
    branch.compressed_at_head_message_id = branch.head_message_id
    branch.compressed_source_versions_json = json.dumps(source_versions)
```

---

### 4. 节点内容修改时递增 version

```python
def update_node_content(node_id: str, new_content: str):
    node = node_store[node_id]
    node.content = new_content
    node.version += 1
    # 不需要主动清除任何分支缓存
    # flatten 时 survivors_valid / sources_valid 会自动检测 version 不一致并触发失效
```

---

### 5. 前端主消息区数据来源调整

当前前端从 `message_nodes + branch.head` 本地重建消息列表，无法展示 summary 虚拟条目。

**改动：** 后端在每次响应中附带 `messages` 字段（即 flatten 结果），前端主消息区直接渲染后端给的 `messages`，不再本地重建。

```
后端响应新增字段：
{
  "messages": [...],          // flatten 结果，含 summary 条目，供主消息区渲染
  "message_nodes": [...],     // 原始节点数据，供右侧树面板渲染，不变
}
```

右侧树面板继续基于 `message_nodes` 渲染原始树结构，两个视图职责分离：

| 视图 | 数据来源 | 内容 |
|------|---------|------|
| 主消息区 | 后端 `messages` | 压缩后的上下文视图，含 summary |
| 树面板 | `message_nodes` | 完整原始树，不含 summary |

前端改动范围：`chat-adapters.ts line 275/320` 附近，主消息流改为优先读取 `response.messages`，降级时回退本地重建逻辑。

---

## 窗口分级参数

```python
def get_tier(window_size: int) -> Tier:
    if window_size <= 128_000:
        return Tier(trigger_ratio=0.6, compress_ratio=0.5)
    elif window_size <= 256_000:
        return Tier(trigger_ratio=0.7, compress_ratio=0.4)
    else:
        return Tier(trigger_ratio=0.8, compress_ratio=0.3)
```

---

## 实施顺序

按以下顺序执行，每步完成后确认功能正常再进入下一步：

**Step 1：数据库 + 模型字段**
- `chat_messages` 表新增 `version INTEGER DEFAULT 0`
- `chat_branches` 表新增 `compressed_path_json TEXT`、`compressed_at_head_message_id TEXT`、`compressed_source_versions_json TEXT`，默认值均为 NULL
- 更新对应的 ORM 模型
- 保留 `archived` 字段，不删除

**Step 2：后端 flatten 替换**
- 按本文档 flatten 逻辑重写
- 确认无缓存时走原始链路，结果与现有 flatten 一致
- 确认 `survivors_valid` 和 `sources_valid` 校验逻辑正确

**Step 3：后端压缩函数替换**
- 移除修改 `parent_id` 和写入 `archived` 的逻辑
- 改为构建 `compressed_path_json` 写入分支
- 确认压缩后 flatten 返回结果正确，token 低于阈值

**Step 4：后端响应附带 messages 字段**
- 每次响应新增 `messages` 字段（flatten 结果）
- 保留 `message_nodes` 字段不变

**Step 5：前端主消息区改数据来源**
- 主消息流优先读取 `response.messages`
- 树面板保持读取 `message_nodes`，不改动
- 确认 summary 条目在主消息区正确渲染

**Step 6：接入 version 递增**
- 编辑节点内容时调用 `update_node_content`，确认 version 递增
- 验证下次 flatten 时缓存正确失效并回退原始链路

> Step 1-4 为后端改动，Step 5-6 需前后端配合。append 优化和 `archived` 字段清理留待后续版本处理。

---

## 回归测试场景

| 场景 | 预期结果 |
|------|---------|
| main 触发压缩，sidebar 共享祖先节点 | sidebar flatten 走原始链路，结果不受影响 |
| main 压缩后切换到 sidebar 发送消息 | sidebar 独立判断是否需要压缩，main 缓存不变 |
| main 压缩后新增消息 | 缓存过期（head 变化），下次 flatten 回退原始链路 |
| 编辑 main 中 survivor 区节点 | version 递增，下次 flatten survivors_valid 失败，缓存失效 |
| 编辑 main 中已被压缩的历史节点 | version 递增，下次 flatten sources_valid 失败，缓存失效 |
| main 再次触发压缩 | 重新生成缓存，覆盖旧缓存 |
| summary 条目在主消息区显示 | 渲染后端 messages 字段，summary 正常展示 |
| 树面板展示原始树 | 继续基于 message_nodes，不含 summary，结构完整 |
