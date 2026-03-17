# Branchat 上下文压缩重构方案

## 现有问题

当前压缩实现存在一个根本性缺陷：**压缩操作会修改节点的 `parent_id` 并将节点标记为 `archived`，导致共享该节点的其他分支在 flatten 和 UI 中断路。**

具体表现：

1. `flatten` 默认过滤 `archived` 节点，若共享祖先节点被压缩标记为 `archived`，依赖它的其他分支 flatten 结果将缺失该节点之前的所有上下文。
2. 前端树面板同样过滤 `archived` 节点，共享祖先节点在 UI 上"消失"，分支显示断裂。
3. 压缩逻辑不感知分叉点，会无差别地将分叉点纳入压缩范围，触发上述问题。

---

## 改进思路

**核心原则：原始树结构只读，压缩结果作为分支级缓存独立存储。**

- `node_store` 中的节点结构和 `parent_id` 永远不被压缩逻辑修改
- 压缩产生的 summary 不插入树中，而是存入该分支的 `compressed_path` 缓存
- flatten 时优先使用缓存，缓存失效时回退到原始链路
- 各分支的压缩缓存完全独立，共享祖先问题从根本上消失

---

## 最新数据结构

### MessageNode

移除 `archived` 字段，新增 `version` 字段用于缓存一致性校验：

```python
class MessageNode:
    id: str              # UUID，创建后不变
    role: str            # "user" | "assistant" | "summary"
    content: str         # 消息内容
    parent_id: str       # 父节点 id，根节点为 None
    modified_from: str   # 修改来源节点 id，默认 None
    pinned: bool         # True 时不参与压缩，默认 False
    stale: bool          # 父节点内容被修改后标记为 True，默认 False
    version: int         # content 每次被修改时递增，初始为 0
```

> `archived` 字段废弃删除。压缩不再修改任何节点字段，节点一旦创建只有 `content`、`stale`、`version` 可能变化。

---

### CachedPathEntry（缓存路径中的节点快照）

缓存路径中每个条目除了节点引用外，还记录该节点的 version 快照，用于失效检测：

```python
class CachedPathEntry:
    node_id: str     # 对应节点的 id
    role: str        # 冗余存储，避免每次查表
    content: str     # 冗余存储，压缩时 summary 内容直接存这里
    version: int     # 记录缓存时该节点的 version，用于比对
```

---

### Branch

分支表从原来只存叶节点 id，扩展为包含压缩缓存：

```python
class Branch:
    leaf_id: str                          # 当前叶节点 id
    compressed_path: list[CachedPathEntry] | None  # 压缩后的路径缓存，None 表示无缓存
    compressed_at_leaf: str | None        # 生成缓存时的叶节点 id，用于判断缓存是否过期
```

全局分支表：

```python
branches: dict[str, Branch] = {
    "main":    Branch(leaf_id="node_G", compressed_path=None, compressed_at_leaf=None),
    "sidebar": Branch(leaf_id="node_I", compressed_path=None, compressed_at_leaf=None),
}

HEAD: str = "main"
```

---

## 核心执行逻辑

### 1. flatten

发送 API 前调用，返回当前分支的完整上下文列表：

```python
def flatten(branch_name: str) -> list[dict]:
    branch = branches[branch_name]

    # 有缓存，且缓存未过期
    if branch.compressed_path and branch.compressed_at_leaf == branch.leaf_id:
        # 校验缓存内每个节点的 version 是否仍然一致
        if is_cache_valid(branch.compressed_path):
            return [{"role": e.role, "content": e.content} for e in branch.compressed_path]
        else:
            # version 不一致，缓存失效，清除
            branch.compressed_path = None
            branch.compressed_at_leaf = None

    # 无缓存或缓存失效，走原始链路
    return walk_parent_chain(branch.leaf_id)


def walk_parent_chain(node_id: str) -> list[dict]:
    path = []
    current = node_store.get(node_id)
    while current:
        path.append({"role": current.role, "content": current.content})
        current = node_store.get(current.parent_id)
    return list(reversed(path))


def is_cache_valid(cached_path: list[CachedPathEntry]) -> bool:
    for entry in cached_path:
        node = node_store.get(entry.node_id)
        if node and node.version != entry.version:
            return False
    return True
```

---

### 2. 发送前压缩检测

在 flatten 之后、调用 API 之前执行：

```python
def prepare_context(branch_name: str) -> list[dict]:
    branch = branches[branch_name]
    window_size = get_model_window_size()
    tier = get_tier(window_size)

    # 先尝试用缓存 flatten
    context = flatten(branch_name)
    total_tokens = estimate_tokens(context)

    # 未超阈值，直接返回
    if total_tokens < window_size * tier.trigger_ratio:
        return context

    # 超阈值，触发压缩
    compress(branch_name, tier)
    return flatten(branch_name)
```

---

### 3. 压缩

压缩只操作分支的缓存，不修改 node_store 中任何节点：

```python
def compress(branch_name: str, tier: Tier):
    branch = branches[branch_name]

    # 获取原始完整路径（节点对象列表）
    full_path = walk_parent_chain_as_nodes(branch.leaf_id)

    # 过滤不可压缩节点（pinned）
    compressible = [n for n in full_path if not n.pinned]

    # 确定压缩范围
    cut = int(len(compressible) * tier.compress_ratio)
    to_compress = compressible[:cut]
    survivors = full_path[full_path.index(compressible[cut]):]  # cut 之后的所有节点

    if not to_compress:
        return

    # 调用 API 生成摘要
    summary_text = call_summary_api(
        [{"role": n.role, "content": n.content} for n in to_compress]
    )

    # 构建新的缓存路径
    # 1. pinned 节点原样保留在最前
    pinned_entries = [
        CachedPathEntry(node_id=n.id, role=n.role, content=n.content, version=n.version)
        for n in full_path if n.pinned and n in full_path[:full_path.index(compressible[0])]
    ]

    # 2. 摘要条目（role 标记为 summary，node_id 为空表示虚拟节点）
    summary_entry = CachedPathEntry(
        node_id="",
        role="summary",
        content=summary_text,
        version=0
    )

    # 3. 幸存节点条目
    survivor_entries = [
        CachedPathEntry(node_id=n.id, role=n.role, content=n.content, version=n.version)
        for n in survivors
    ]

    # 写入缓存
    branch.compressed_path = pinned_entries + [summary_entry] + survivor_entries
    branch.compressed_at_leaf = branch.leaf_id
```

---

### 4. 新增消息时更新缓存

新消息产生后，无需重新压缩，直接追加到现有缓存末尾：

```python
def append_message_to_cache(branch_name: str, new_node: MessageNode):
    branch = branches[branch_name]

    if branch.compressed_path is not None:
        entry = CachedPathEntry(
            node_id=new_node.id,
            role=new_node.role,
            content=new_node.content,
            version=new_node.version
        )
        branch.compressed_path.append(entry)

    # 更新叶节点
    branch.leaf_id = new_node.id
    branch.compressed_at_leaf = new_node.id
```

---

### 5. 节点内容被修改时使缓存失效

用户编辑 AI 回复并提交时，更新节点 version，version 不一致会在下次 flatten 时自动触发缓存失效：

```python
def update_node_content(node_id: str, new_content: str):
    node = node_store[node_id]
    node.content = new_content
    node.version += 1
    # 无需主动清除任何分支缓存，is_cache_valid 会在 flatten 时自动检测
```

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

## 迁移步骤

现有代码库的改造按以下顺序执行，每步完成后确认功能正常再进入下一步：

**Step 1：更新 MessageNode**
- 删除 `archived` 字段
- 新增 `version: int = 0` 字段
- 更新所有涉及 `archived` 的查询和过滤逻辑（`flatten`、前端树面板）

**Step 2：更新 Branch 数据结构**
- 在分支表中为每条分支新增 `compressed_path`、`compressed_at_leaf` 字段
- 初始值均为 `None`

**Step 3：替换 flatten 函数**
- 按本文档 flatten 逻辑重写，加入缓存命中判断和 version 校验
- 确认无缓存时走原始链路结果与原 flatten 一致

**Step 4：替换压缩函数**
- 移除原有修改 `parent_id` 和标记 `archived` 的逻辑
- 改为构建 `compressed_path` 缓存写入分支
- 确认压缩后 flatten 返回结果正确

**Step 5：接入 append_message_to_cache**
- 每次新增消息后调用，确保缓存与新消息保持同步

**Step 6：接入 update_node_content 的 version 递增**
- 每次编辑节点内容时递增 version，确认下次 flatten 时缓存正确失效

---

## 各分支场景验证

完成迁移后，用以下场景回归测试：

| 场景 | 预期结果 |
|------|---------|
| main 触发压缩，sidebar 共享祖先节点 | sidebar flatten 结果不受影响，走原始链路 |
| main 压缩后新增消息 | 缓存 append，不触发重新压缩 |
| 编辑 main 中已被缓存的节点 | version 递增，下次 flatten 时缓存失效，回退原始链路 |
| main 再次触发压缩 | 重新生成缓存，旧缓存覆盖 |
| 切换到 sidebar 发送消息 | sidebar 独立压缩，main 缓存不受影响 |
