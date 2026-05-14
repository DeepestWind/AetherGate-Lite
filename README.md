# Branchat

> 普通 chatbot 是一条单链，Branchat 是一棵树。

可分支、可编辑、可压缩的树形对话系统。从任意 AI 回复开辟支线、原地修改历史回答继续生成、为同一轮回答保留多个变体，并在上下文过长时把早期历史压缩为摘要节点——而不是简单截断。

---

## 它不一样在哪

```
普通 chatbot:    A → B → C → D → E
                       想追问 C 里的支线问题？只能在 D 之后问，污染主线。

Branchat:        A → B → C → D → E       ← main
                         ↓
                         F → G           ← 从 C 派生的支线，独立推进
```

- **分支不污染主线**：从任意 AI 节点开新支线，主线指针完全不动。
- **可控编辑**：直接修改 AI 回复，再基于修改后的内容继续生成。旧子节点标记为 stale 但完整保留。
- **多变体共存**：同一轮回答可以保留多个兄弟节点，按需切换。
- **压缩不破坏树**：超长会话自动把早期历史压成 summary，**只在分支级缓存**，原始树永远只读，共享祖先不会断链。

想了解为什么这样设计，看：

- [chatbot-branch-design](./docs/chatbot-branch-design.md) — 数据结构与核心操作
- [branchat-compression-refactor-v4](./docs/branchat-compression-refactor-v4.md) — 压缩方案的最终设计

---

## 核心能力

只做四件事：

| 能力 | 说明 |
| --- | --- |
| **分支对话** | 从任意 AI 节点开辟新支线，多个支线独立推进，可在分支间切换。 |
| **编辑历史回复** | 修改历史 AI 节点后继续对话，让后续朝你希望的方向前进。 |
| **多变体重生** | 同一轮回答可保留多个兄弟节点，按当前可见快照生成。 |
| **上下文压缩** | 根据模型窗口大小自动压缩早期历史，对超长会话友好。 |

### 节点交互规则

| 节点类型 | 可用操作 |
| --- | --- |
| 用户节点（叶子） | 无 |
| AI 节点（叶子） | 编辑、重新生成、从此分叉 |
| AI 节点（历史） | 从此分叉 |

只有当前 branch 指针指向的叶子节点才能继续生成；历史节点默认只用于回看和派生新分支。

### 上下文压缩档位

| 档位 | 窗口大小 | 触发阈值 | 压缩范围 |
| --- | --- | --- | --- |
| 小窗口 | `<= 128k` | `60%` | 前 `50%` |
| 中窗口 | `<= 256k` | `70%` | 前 `40%` |
| 大窗口 | `> 256k` | `80%` | 前 `30%` |

压缩时跳过 `pinned` 节点，结果作为分支级缓存独立存储，原始 `parent_id` 链永远只读。

---

## 内置基础设施

为了支撑上面这套聊天体验，仓库内置了一组较小的辅助能力。它们不是产品亮点，只是把地基做稳。

- **多端点网关**：把一个逻辑模型映射到多个真实上游端点（OpenAI 兼容服务、Ollama），按指定或轮转策略选择，失败时顺序 fallback，连续失败自动熔断冷却。
- **Prompt 模板**：可复用、变量化的 system 提示词，在网关层注入。
- **OpenAI 兼容出口**：顺带暴露 `/v1/chat/completions` 和 `/v1/models`，让现有客户端可以直接对接。
- **运行指标与日志**：每次调用落一条 RequestLog，聚合指标、趋势、分页查询都基于它。
- **React 控制台**：用于配置端点、Prompt、Token，以及 chat 调试。

---

## 快速开始

运行要求：可用的 `uv`、Node.js `^20.19.0 || >=22.12.0` 和 `npm`。Python 版本由仓库根目录的 `.python-version` 固定为 `3.12`，依赖由 `uv.lock` 锁定；前端依赖由 `frontend/console/package-lock.json` 锁定。

### 1. 初始化配置

```bash
cp config.example.toml config.toml
uv sync --locked
```

最少确认这三项：

- `auth_token`：控制台和受保护接口使用的 Bearer Token
- `master_key`：用于加密存储上游 API Key，**端点持久化前必须固定下来**
- `database_url`：默认 SQLite，开箱即用

### 2. 一条命令启动

```bash
./scripts/start.sh
```

这会同时启动：

- 后端 API：`http://127.0.0.1:8000`
- 前端控制台：`http://127.0.0.1:3001`

后端启动脚本要求本机已安装 `uv`；缺少 `uv` 会直接失败。后端测试使用：

```bash
uv run --locked pytest
```

前端脚本要求使用 npm。首次启动或构建时，如果 `frontend/console/node_modules` 不存在，脚本会执行 `npm ci` 按锁文件安装依赖。前端测试和构建使用：

```bash
cd frontend/console
npm test
npm run build
```

更细的启动选项、环境变量、安全注意事项与生产部署，见 [docs/operations.md](./docs/operations.md)。

---

## API 概览

### Chat（核心）

| 路径 | 说明 |
| --- | --- |
| `GET /api/chat/conversations` | 列出会话 |
| `POST /api/chat/conversations` | 创建会话 |
| `GET /api/chat/conversations/{id}` | 获取会话与消息树 |
| `PATCH /api/chat/conversations/{id}` | 重命名 |
| `DELETE /api/chat/conversations/{id}` | 删除 |
| `PUT /api/chat/conversations/{id}/config` | 保存草稿配置 |
| `POST /api/chat/conversations/{id}/messages[/stream]` | 发送消息（含流式） |
| `POST /api/chat/conversations/{id}/messages/commit[/stream]` | 提交编辑后继续生成 |
| `POST /api/chat/conversations/{id}/messages/{mid}/branch-edit/stream` | 编辑节点后基于修改内容生成 |
| `POST /api/chat/conversations/{id}/messages/{mid}/regenerate/stream` | 重新生成 |
| `POST /api/chat/conversations/{id}/messages/{mid}/stop` | 停止当前生成 |
| `POST /api/chat/conversations/{id}/branches` | 从指定节点新建分支 |

### 基础设施接口

<details>
<summary>Gateway / Endpoints / Prompts / Internal</summary>

| 路径 | 说明 |
| --- | --- |
| `POST /v1/chat/completions` | OpenAI-compatible 聊天补全 |
| `GET /v1/models` | 逻辑模型列表 |
| `GET/POST/PUT/DELETE /api/endpoints` | 模型端点管理 |
| `POST /api/endpoints/{id}/validate` | 校验端点是否可用 |
| `GET/POST/PUT/DELETE /api/prompts` | Prompt 模板管理 |
| `POST /api/prompts/{id}/preview` | Prompt 渲染预览 |
| `GET /internal/health` | 健康检查（无需鉴权） |
| `GET /internal/metrics` | 聚合指标 |
| `GET /internal/stats` | 趋势统计 |
| `GET /internal/logs` | 请求日志查询 |

</details>

完整字段定义见 FastAPI OpenAPI 文档：

- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 项目结构

```text
.
├── app/                  # FastAPI 应用、领域模型、服务与数据访问层
│   ├── api/              # REST / SSE 路由
│   ├── core/             # 配置、鉴权、日志、安全能力
│   ├── db/               # 数据库引擎、Schema 兼容逻辑
│   ├── models/           # SQLAlchemy 模型
│   ├── providers/        # 上游模型 Provider 适配层
│   ├── repositories/     # 数据访问封装
│   ├── schemas/          # Pydantic 请求/响应结构
│   └── services/         # 网关、路由、会话、Prompt、指标等业务服务
├── frontend/console/     # React + Vite 控制台
├── tests/                # 后端测试
├── scripts/              # 一键启动与构建脚本
├── docs/                 # 设计与重构说明文档
├── config.example.toml   # 示例配置
└── pyproject.toml        # Python 项目定义
```

---

## 协议

MIT License © Branchat
