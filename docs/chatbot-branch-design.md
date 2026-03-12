# 可分支、可修改的 Chatbot 设计方案：Branchat

## 设计初衷

普通 Chatbot 的对话是一条单链，遇到"支线问题"（比如 AI 回复中出现不熟悉的关键词想追问）就不得不在主线中提问，污染上下文，导致后续主线对话质量下降。

本方案目标：将对话结构从"链"升级为"树"，支持从任意节点分叉、修改历史消息，同时保持历史完整可回溯。

---

## 核心数据结构

### 节点（MessageNode）

```python
class MessageNode:
    id: str          # UUID，与内容无关，创建后不变
    role: str        # "user" 或 "assistant"
    content: str     # 消息内容，可被修改
    parent_id: str   # 父节点的 id，根节点为 None
```

> 节点只记录"自己是谁"和"父节点是谁"，不存子节点引用。

### 全局索引与分支指针

```python
# 哈希表：用于 O(1) 定位任意节点
node_store: dict[str, MessageNode] = {}

# 分支表：分支名 -> 当前叶节点 id
branches: dict[str, str] = {
    "main": "node_id_D",
    "sidebar": "node_id_F",
}

# 当前所在分支
HEAD: str = "main"
```

---

## 核心操作

### 发送消息

1. 新建一个 `MessageNode`，`parent_id` 指向当前分支的叶节点
2. 写入 `node_store`
3. 把当前分支指针更新为新节点的 id

### 获取上下文（发给 API 前）

从当前节点沿 `parent_id` 向上追溯到根节点，反转后得到扁平列表：

```python
def flatten(node_id: str) -> list:
    path = []
    current = node_store[node_id]
    while current:
        path.append({"role": current.role, "content": current.content})
        current = node_store.get(current.parent_id)
    return list(reversed(path))
```

时间复杂度 O(n)，n 为对话深度，实际场景中可忽略不计。

### 新建分支

从任意节点出发，在 `branches` 中新增一条记录即可，原有节点数据完全不动：

```python
branches["sidebar"] = "node_id_C"  # 从 C 节点开一条新分支
```

```
main:    A - B - C - D
                 ↑
sidebar:         C - E - F
```

C 节点被两条分支共享，不复制、不修改。

### 切换分支

只需修改 HEAD，零成本：

```python
HEAD = "sidebar"
```

---

## 修改历史消息的方案

### 前端缓冲层

修改操作分两个阶段：

**阶段一：编辑中（未提交）**
- 修改只在前端维护，使用可撤回的 diff 存储
- 不影响后端任何数据
- 用户可随意撤回、重做

**阶段二：提交新请求时**
- 前端将"被修改过的节点 id 列表"连同新消息一起发送给后端
- 后端按 id 查 `node_store`，直接更新对应节点的 `content` 字段
- 修改至此固化，不可再撤回

### 关于修改后的旧子节点

修改某节点后，其旧有子节点（基于旧内容生成的 AI 回复）在逻辑上已"失效"。推荐处理方式：

- 给旧子节点加 `stale: true` 标记
- UI 上灰显或隐藏，不主动展示
- 数据保留，历史可查

---

## 为什么 id 使用 UUID 而非内容 Hash

| | UUID | 内容 Hash（如 Git） |
|---|---|---|
| 内容修改后 id 变化 | ❌ 不变 | ✅ 会变 |
| 适合原地修改 | ✅ | ❌ |
| 天然去重 | ❌ | ✅ |

本方案需要支持原地修改 content，且对话场景不需要去重，因此选用 UUID。

---

## 整体架构总结

| 结构 | 职责 |
|---|---|
| 树（parent_id 指针） | 表达节点间父子关系，用于 flatten 历史 |
| 哈希表（node_store） | O(1) 定位任意节点，用于交互操作 |
| 分支表（branches） | 轻量管理多条对话线 |
| 前端 diff 缓冲 | 提交前的可撤回编辑暂存 |

**核心原则：** 树结构负责关系，哈希表负责寻址，前端缓冲负责体验，三层职责清晰分离。
