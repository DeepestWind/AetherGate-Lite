# Branchat 可分支、可修改的对话设计方案

## 设计初衷

普通 Chatbot 的对话是一条单链，遇到"支线问题"（比如 AI 回复中出现不熟悉的关键词想追问）就不得不在主线中提问，污染上下文，导致后续主线对话质量下降。

本方案目标：将对话结构从"链"升级为"树"，支持从任意节点分叉、修改历史消息，同时保持历史完整可回溯。

---

## 核心数据结构

### 节点（MessageNode）

```python
class MessageNode:
    # 基础字段
    id: str            # UUID，与内容无关，创建后不变
    role: str          # "user" | "assistant" | "summary"
    content: str       # 消息内容，可被修改
    parent_id: str     # 父节点的 id，根节点为 None

    # 分支与修改相关
    modified_from: str # 若此节点由修改产生，记录原节点 id，否则为 None

    # 压缩相关
    pinned: bool       # True 时不参与压缩，默认 False
    archived: bool     # 被压缩绕开的旧节点标记为 True，默认 False

    # 失效标记
    stale: bool        # 父节点内容被修改后此节点标记为 True，默认 False
```

> 节点只记录"自己是谁"和"父节点是谁"，不存子节点引用。`archived` 和 `stale` 主要服务于 UI 展示，初期可暂缓实现，其余字段均为核心逻辑必需。

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

## 为什么 id 使用 UUID 而非内容 Hash

| | UUID | 内容 Hash（如 Git） |
|---|---|---|
| 内容修改后 id 变化 | ❌ 不变 | ✅ 会变 |
| 适合原地修改 | ✅ | ❌ |
| 天然去重 | ❌ | ✅ |

本方案需要支持原地修改 content，且对话场景不需要去重，因此选用 UUID。

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

时间复杂度 O(n)，n 为对话深度，实际场景中可忽略不计。`summary` 节点会被自然拼入上下文，对 API 来说就是一条普通消息，flatten 函数无需任何改动。

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

修改某节点后，其旧有子节点（基于旧内容生成的 AI 回复）在逻辑上已"失效"：

- 给旧子节点标记 `stale: true`
- UI 上灰显，提示用户该回复基于旧内容生成
- 数据保留，历史可查

---

## 上下文压缩方案

Branchat 的树形结构天然缓解了上下文膨胀——每条支线只携带自己路径上的消息。但单条支线聊得足够深时，仍需主动管理上下文长度。

### 窗口分级与压缩参数

初始化时检测接入模型的 context window 大小，自动匹配对应参数：

| 档位 | 窗口大小 | 触发阈值 | 压缩范围 | 策略倾向 |
|------|---------|---------|---------|---------|
| 小窗口 | ≤ 128k | 60% | 压缩前 50% | 激进 |
| 中窗口 | ≤ 256k | 70% | 压缩前 40% | 适中 |
| 大窗口 | > 256k | 80% | 压缩前 30% | 保守 |

> 触发阈值预留的空间用于 AI 回复输出、用户下一条输入，以及避免压缩后立即再次触发。上述参数为经验初始值，建议上线后根据信息损失程度和触发频率持续校准。

### Token 计算

每次发送前对当前路径所有消息的 token 加总，与触发阈值比较：

- 精确计算：使用 tiktoken 等库逐条计算
- 快速估算：英文字符数 ÷ 4，中文字数 × 1～1.5

### 锚点消息（Pinned）

以下消息不参与压缩，始终保留原文：

- 对话首条消息（通常包含用户定义的背景、角色、约束）
- 用户或系统手动标记为 `pinned: true` 的消息
- `summary` 节点本身（避免被二次压缩）

### 压缩如何接入树结构

压缩后新建一个 `summary` 节点插入父子链，替代被压缩的那段节点，原有链的遍历逻辑完全不受影响：

```
压缩前：pinned_A → B → C → D → E → F
                   ↑_________↑
                   这段被压缩

压缩后：pinned_A → [Summary:BCD] → E → F
```

具体操作：
1. 创建 `summary` 节点 S，`parent_id` 指向压缩段之前的锚点节点
2. 将压缩段之后第一个存活节点的 `parent_id` 改为 S 的 id
3. 被绕开的旧节点标记 `archived: true`，保留在 `node_store` 中供历史查看

```python
def compress(nodes_to_compress, first_survivor, anchor_node, summary_text):
    summary_node = MessageNode(
        id=new_uuid(),
        role="summary",
        content=summary_text,
        parent_id=anchor_node.id,
        pinned=True
    )
    node_store[summary_node.id] = summary_node
    first_survivor.parent_id = summary_node.id

    for node in nodes_to_compress:
        node.archived = True
```

---

## 整体架构总结

| 结构 | 职责 |
|---|---|
| 树（parent_id 指针） | 表达节点间父子关系，用于 flatten 历史 |
| 哈希表（node_store） | O(1) 定位任意节点，用于交互操作与压缩 |
| 分支表（branches） | 轻量管理多条对话线 |
| 前端 diff 缓冲 | 提交前的可撤回编辑暂存 |

**核心原则：** 树结构负责关系，哈希表负责寻址，前端缓冲负责体验，三层职责清晰分离。任何操作——分叉、修改、压缩——都只新增或修改节点字段，不破坏已有的父子链结构。
