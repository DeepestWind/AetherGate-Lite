# Branchat 上下文压缩重构方案 v3

## 现有问题

当前压缩实现存在一个根本性缺陷：**压缩操作直接修改节点的 `parent_id` 并标记 `archived`（`chat_sessions.py line 809`），导致共享该节点的其他分支在 flatten 和 UI 中断路。**

具体表现：

1. `flatten` 过滤 `archived` 节点（`chat_sessions.py line 239`），若共享祖先被压缩标记为 `archived`，依赖它的其他分支 flatten 结果将缺失该节点之前的所有上下文。
2. 前端树面板同样过滤 `archived` 节点（`conversation-tree-panel.tsx line 18`），共享祖先在 UI 上消失，分支显示断裂。
3. 前端主消息区目前从 `message_nodes + branch.head` 本地重建消息列表（`chat-adapters.ts line 275/320`），虚拟 summary 节点不在 `message_nodes` 里将不会渲染。

---

## 改进核心思路

**原始树结构只读，压缩结果作为分支级缓存独立存储。**

- `node_store` 中所有节点的 `parent_id` 永远不被压缩逻辑修改
- 压缩产生的 summary 不插入原始树，存入该分支的 `compressed_path` 缓存字段
- flatten 时优先使用缓存，缓存失效时回退原始 `parent_id` 链路
- 各分支缓存完全独立，共享祖先问题从根本上消失
- 新增独立函数处理可见消息和上下文构建，不改动现有 `flatten_messages()`
- 前端主消息区改为信后端返回的 `visible_messages`，树面板继续基于原始 `message_nodes` 渲染

---

## 数据结构改动

### ChatMessageRecord（后端消息节点）

新增 `version` 字段，**保留 `archived` 字段不删除**（现有代码多处依赖，待全链路切干净后再清理）：

```python
class ChatMessageRecord:
    id: str
    role: str            # "user" | "assistant"
    content: str
    parent_id: str | None
    modified_from: str | None
    pinned: bool
    stale: bool
    archived: bool       # 保留，新压缩流程不再写入此字段
    version: int = 0     # 新增，以下两种操作时递增：
                         #   1. content 被修改
                         #   2. pinned 状态被修改
                         # （pinned 是压缩选择条件，改变它需要使相关缓存失效）
```

> 新压缩流程**不再修改任何节点的 `parent_id`，也不再写入 `archived`**。

---

### VisibleMessageResponse（新增，主消息区专用 schema）

不复用现有 `ChatMessageResponse`，避免虚拟 summary 条目与要求真实节点字段的现有 schema 冲突：

```python
class VisibleMessageResponse:
    virtual_id: str          # 展示用唯一 id，summary 条目用生成的 uuid，普通节点与 node_id 相同
    kind: str                # "node" | "summary"
    role: str                # "user" | "assistant" | "summary"
    content: str
    source_node_id: str | None  # kind="node" 时为真实节点 id，kind="summary" 时为 None
```

---

### CachedPathEntry（缓存路径条目，序列化存入 compressed_path_json）

```python
class CachedPathEntry:
    node_id: str     # 对应节点的 id，summary 条目为空字符串
    role: str        # "user" | "assistant" | "summary"
    content: str     # 消息内容，summary 条目为摘要文本
    version: int     # 记录缓存时该节点的 version，summary 条目为 0
```

---

### ChatBranch（后端分支记录）

新增三个字段：

```python
class ChatBranch:
    head_message_id: str                           # 当前叶节点 id（原有）
    base_message_id: str                           # 分支起点（原有）

    compressed_path_json: str | None = None
    # 序列化的 CachedPathEntry 列表
    # None 表示无缓存，flatten 直接走原始链路

    compressed_at_head_message_id: str | None = None
    # 生成缓存时的叶节点 id
    # 与当前 head_message_id 不一致时视为过期

    compressed_source_versions_json: str | None = None
    # 被压缩段的节点版本快照：{"node_id": version, ...}
    # 用于检测被压缩段的节点是否被事后编辑或 pin 状态改变
```

数据库迁移：给 `chat_branches` 表新增以上三个 TEXT 字段，默认值均为 NULL。

---

## 核心函数实现

### 保留现有函数不改动

```
flatten_messages(branch) -> list[ChatMessageRecord]
```

现有此函数继续保留，返回原始节点链路，供树逻辑、调试、消息节点响应使用，**不做任何修改**。

---

### 新增：build_context_view（供 API 调用使用）

```python
def build_context_view(branch: ChatBranch) -> list[dict]:
    """
    返回发给 LLM API 的上下文列表。
    优先使用压缩缓存，失效时回退原始链路。
    """

    # 无缓存
    if not branch.compressed_path_json:
        return _walk_to_dict(branch.head_message_id)

    # 缓存过期（叶节点已变化）
    if branch.compressed_at_head_message_id != branch.head_message_id:
        return _walk_to_dict(branch.head_message_id)

    cached_path = json.loads(branch.compressed_path_json)

    # survivor 节点 version 校验
    if not _survivors_valid(cached_path):
        _invalidate_cache(branch)
        return _walk_to_dict(branch.head_message_id)

    # 被压缩段 version 校验（防御性）
    if branch.compressed_source_versions_json:
        source_versions = json.loads(branch.compressed_source_versions_json)
        if not _sources_valid(source_versions):
            _invalidate_cache(branch)
            return _walk_to_dict(branch.head_message_id)

    return [{"role": e["role"], "content": e["content"]} for e in cached_path]


def _walk_to_dict(node_id: str) -> list[dict]:
    path = []
    current = node_store.get(node_id)
    while current:
        path.append({"role": current.role, "content": current.content})
        current = node_store.get(current.parent_id)
    return list(reversed(path))


def _survivors_valid(cached_path: list[dict]) -> bool:
    for entry in cached_path:
        if not entry["node_id"]:
            continue  # summary 虚拟条目跳过
        node = node_store.get(entry["node_id"])
        if node and node.version != entry["version"]:
            return False
    return True


def _sources_valid(source_versions: dict) -> bool:
    for node_id, cached_version in source_versions.items():
        node = node_store.get(node_id)
        if node and node.version != cached_version:
            return False
    return True


def _invalidate_cache(branch: ChatBranch):
    branch.compressed_path_json = None
    branch.compressed_at_head_message_id = None
    branch.compressed_source_versions_json = None
```

---

### 新增：flatten_visible_messages（供主消息区使用）

```python
def flatten_visible_messages(branch: ChatBranch) -> list[VisibleMessageResponse]:
    """
    返回主消息区渲染用的可见消息列表，含 summary 虚拟条目。
    """

    # 无缓存或缓存过期，走原始节点链路
    if (not branch.compressed_path_json
            or branch.compressed_at_head_message_id != branch.head_message_id):
        return _nodes_to_visible(flatten_messages(branch))

    cached_path = json.loads(branch.compressed_path_json)

    # 校验失败，回退原始链路
    if not _survivors_valid(cached_path):
        _invalidate_cache(branch)
        return _nodes_to_visible(flatten_messages(branch))

    if branch.compressed_source_versions_json:
        source_versions = json.loads(branch.compressed_source_versions_json)
        if not _sources_valid(source_versions):
            _invalidate_cache(branch)
            return _nodes_to_visible(flatten_messages(branch))

    # 缓存有效，转为 VisibleMessageResponse
    result = []
    for entry in cached_path:
        if entry["kind"] == "summary" or not entry["node_id"]:
            result.append(VisibleMessageResponse(
                virtual_id=str(uuid4()),
                kind="summary",
                role="summary",
                content=entry["content"],
                source_node_id=None
            ))
        else:
            result.append(VisibleMessageResponse(
                virtual_id=entry["node_id"],
                kind="node",
                role=entry["role"],
                content=entry["content"],
                source_node_id=entry["node_id"]
            ))
    return result


def _nodes_to_visible(nodes: list[ChatMessageRecord]) -> list[VisibleMessageResponse]:
    return [
        VisibleMessageResponse(
            virtual_id=n.id,
            kind="node",
            role=n.role,
            content=n.content,
            source_node_id=n.id
        )
        for n in nodes
    ]
```

---

### 新增：prepare_context（发送前压缩检测）

```python
def prepare_context(branch: ChatBranch) -> list[dict]:
    """
    在调用 LLM API 前执行，超阈值时触发压缩并更新缓存。
    """
    window_size = get_model_window_size()
    tier = get_tier(window_size)

    context = build_context_view(branch)
    total_tokens = estimate_tokens(context)

    if total_tokens < window_size * tier.trigger_ratio:
        return context

    compress(branch, tier)
    return build_context_view(branch)
```

---

### 新增：compress（只操作分支缓存，不改原始树）

**关键修正：始终基于 `full_path` 原顺序工作，在原路径上找连续的可压缩区间，用 summary 替换，不拆组重拼。**

```python
def compress(branch: ChatBranch, tier: Tier):
    """
    压缩当前分支的上下文，结果写入分支缓存。
    不修改任何节点的 parent_id，不写入 archived。
    """

    full_path = _walk_to_nodes(branch.head_message_id)
    # full_path: 从根到叶的完整 ChatMessageRecord 列表，保持原始顺序

    # 在原始顺序上找第一段连续的、不含 pinned 节点的可压缩区间
    compress_start = None
    compress_end = None
    for i, node in enumerate(full_path):
        if not node.pinned:
            if compress_start is None:
                compress_start = i
            compress_end = i
        else:
            # 遇到 pinned 节点，若已找到起点则截止
            if compress_start is not None:
                break

    if compress_start is None:
        return  # 没有可压缩节点

    # 按 compress_ratio 确定实际压缩区间终点
    compressible_count = compress_end - compress_start + 1
    cut = max(1, int(compressible_count * tier.compress_ratio))
    actual_end = compress_start + cut  # 不含此索引

    to_compress = full_path[compress_start:actual_end]
    if not to_compress:
        return

    # 生成摘要
    summary_text = call_summary_api(
        [{"role": n.role, "content": n.content} for n in to_compress]
    )

    # 构建缓存路径：原始顺序，压缩段替换为 summary 条目，其余原样
    cached_path = []

    # 压缩段之前的节点
    for node in full_path[:compress_start]:
        cached_path.append({
            "node_id": node.id,
            "role": node.role,
            "content": node.content,
            "version": node.version
        })

    # summary 条目
    cached_path.append({
        "node_id": "",
        "role": "summary",
        "content": summary_text,
        "version": 0
    })

    # 压缩段之后的节点
    for node in full_path[actual_end:]:
        cached_path.append({
            "node_id": node.id,
            "role": node.role,
            "content": node.content,
            "version": node.version
        })

    # 被压缩段的版本快照
    source_versions = {n.id: n.version for n in to_compress}

    # 写入分支缓存
    branch.compressed_path_json = json.dumps(cached_path)
    branch.compressed_at_head_message_id = branch.head_message_id
    branch.compressed_source_versions_json = json.dumps(source_versions)


def _walk_to_nodes(node_id: str) -> list[ChatMessageRecord]:
    path = []
    current = node_store.get(node_id)
    while current:
        path.append(current)
        current = node_store.get(current.parent_id)
    return list(reversed(path))
```

---

### 节点状态修改时递增 version

```python
def update_node_content(node_id: str, new_content: str):
    node = node_store[node_id]
    node.content = new_content
    node.version += 1
    # 不主动清除任何分支缓存
    # build_context_view / flatten_visible_messages 调用时自动检测失效


def update_node_pinned(node_id: str, pinned: bool):
    node = node_store[node_id]
    node.pinned = pinned
    node.version += 1
    # pinned 是压缩选择条件，状态改变需要使相关缓存失效
    # 同样由 version 校验自动处理，无需主动清除
```

---

## 后端响应结构调整

每次响应新增 `visible_messages` 字段，供前端主消息区使用：

```python
class ChatResponse:
    visible_messages: list[VisibleMessageResponse]  # 新增，主消息区数据源
    message_nodes: list[ChatMessageRecord]           # 原有，树面板数据源，不变
    # 其余原有字段保持不变
```

---

## 前端数据来源分离

| 视图 | 数据来源 | 内容 |
|------|---------|------|
| 主消息区 | `response.visible_messages` | 压缩后的上下文视图，含 summary 条目 |
| 右侧树面板 | `response.message_nodes` | 完整原始树，不含 summary，结构不变 |

前端改动范围：`chat-adapters.ts line 275/320` 附近，主消息流改为优先读取 `response.visible_messages`，降级时回退本地重建逻辑。树面板不做任何改动。

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

**Step 1：数据库 + 模型字段**
- `chat_messages` 表新增 `version INTEGER DEFAULT 0`
- `chat_branches` 表新增 `compressed_path_json TEXT`、`compressed_at_head_message_id TEXT`、`compressed_source_versions_json TEXT`，默认值均为 NULL
- 更新对应 ORM 模型
- 保留 `archived` 字段，不删除

**Step 2：新增 VisibleMessageResponse schema**
- 新建 `VisibleMessageResponse` 数据类
- 不修改现有 `ChatMessageResponse`

**Step 3：新增后端函数，不改现有函数**
- 新增 `build_context_view(branch)`
- 新增 `flatten_visible_messages(branch)`
- 新增 `prepare_context(branch)`
- 新增 `compress(branch, tier)`（新版本，替换旧压缩函数）
- 新增 `update_node_pinned(node_id, pinned)`
- 修改 `update_node_content` 加入 `version += 1`
- **保留现有 `flatten_messages()` 不改动**

**Step 4：后端响应新增 visible_messages 字段**
- `ChatResponse` 新增 `visible_messages: list[VisibleMessageResponse]`
- 保留 `message_nodes` 字段不变

**Step 5：前端主消息区改数据来源**
- 主消息流优先读取 `response.visible_messages`
- 树面板保持读取 `message_nodes`，不改动
- 确认 summary 条目在主消息区正确渲染

**Step 6：接入 version 递增**
- 编辑节点内容时调用 `update_node_content`，确认 version 递增
- pin/unpin 操作时调用 `update_node_pinned`，确认 version 递增
- 验证下次 `build_context_view` 时缓存正确失效并回退原始链路

> append 优化和 `archived` 字段清理留待后续版本处理。

---

## 回归测试场景

| 场景 | 预期结果 |
|------|---------|
| main 触发压缩，sidebar 共享祖先节点 | sidebar `build_context_view` 走原始链路，结果不受影响 |
| 路径中存在 pinned 节点 | 压缩区间在原始顺序上连续选取，pinned 节点不被纳入，顺序不变 |
| main 压缩后切换到 sidebar 发送消息 | sidebar 独立判断是否需要压缩，main 缓存不变 |
| main 压缩后新增消息 | 缓存过期（head 变化），下次回退原始链路 |
| 编辑 main 中 survivor 区节点 content | version 递增，`_survivors_valid` 失败，缓存失效 |
| 编辑 main 中已被压缩的历史节点 content | version 递增，`_sources_valid` 失败，缓存失效 |
| pin/unpin 已被压缩的节点 | version 递增，缓存失效 |
| main 再次触发压缩 | 重新生成缓存，覆盖旧缓存 |
| summary 条目在主消息区显示 | `visible_messages` 中 kind="summary" 条目正常渲染 |
| 树面板展示原始树 | 继续基于 `message_nodes`，不含 summary，结构完整 |
| `flatten_messages()` 原有调用点 | 行为不变，返回原始节点链路 |
