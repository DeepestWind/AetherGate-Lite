# Branchat

一个基于 FastAPI + React 的 AI 对话系统，支持分支会话、模型网关、Prompt 模板管理与调试控制台。

> 对话可以分叉，思路不再跑偏。

Branchat 把传统的线性聊天升级成树形对话结构。你可以从任意 AI 回复继续分支、编辑已有回复来引导后续上下文、为同一轮回答保留多个变体，并在上下文过长时自动压缩历史内容，而不破坏现有对话链。

这个仓库不仅包含 Branchat 的聊天模块，也包含配套的网关服务、模型端点管理、Prompt 模板管理、运行指标接口，以及一个用于管理和调试的 React 控制台。

---

## 它解决什么问题

普通 Chatbot 往往有两个典型问题：

- 你想追问某个支线问题，但一追问就把主线上下文带偏了
- 你知道 AI 该往哪个方向回答，却只能重新提问，无法真正控制下一步上下文

Branchat 重点解决的就是这两点：

- **分支对话**：从任意 AI 节点开辟新的支线，主线不受污染
- **可控编辑**：直接修改 AI 回复，再基于修改后的内容继续生成

---

## 核心能力

- **分支会话**：从任意 AI 回复创建分支，多个支线独立推进，可在分支间切换。
- **编辑 AI 回复**：修改历史 AI 节点后继续对话，让后续朝你希望的方向前进。
- **重新生成与变体切换**：同一轮回答可保留多个兄弟节点，按照当前可见快照生成回答。
- **上下文压缩**：根据模型窗口大小自动压缩早期历史，对超长会话更友好。
- **OpenAI兼容接口**：通过 `/v1/chat/completions` 和 `/v1/models` 对外提供兼容接口。
- **模型端点管理**：统一聚合端点，并支持启停、校验、优先级与路由策略。
- **Prompt 模板管理**：为网关和会话配置复用型 Prompt 模板，支持变量注入和预览。
- **运行指标与日志**：提供健康检查、请求日志、统计指标和按天趋势数据。
- **Web 控制台**：内置 React + Vite 管理台，用于配置端点、Prompt、聊天调试和 Token 管理。

---

## 系统组成

Branchat 由几块相互配合的能力组成：

- **Chat Gateway**：统一对接上游模型服务，负责路由、缓存、fallback、Prompt 注入与响应封装。
- **Conversation Engine**：维护树形会话、分支指针、消息可见性、历史变体与上下文压缩。
- **Endpoint Registry**：管理逻辑模型到实际上游端点的映射关系。
- **Prompt Service**：管理模板、变量渲染、启停状态与预览。
- **Console UI**：提供 Dashboard、Endpoint 管理、Prompt 管理与聊天调试页面。


---

## 快速开始

### 运行要求

- Python `>= 3.12`
- 可用的 `npm`
- 推荐安装 `uv`，未安装时脚本会回退到标准 `venv + pip`

### 1. 初始化配置

项目根目录提供了 `config.example.toml`。如果你直接运行启动脚本，缺失的 `config.toml` 会自动创建。

最少需要确认这几个配置项：

- `auth_token`：控制台和受保护接口使用的 Bearer Token
- `master_key`：用于加密存储上游 API Key，请在持久化端点前固定下来
- `database_url`：默认使用 SQLite

建议先把示例配置复制出来并修改敏感字段：

```bash
cp config.example.toml config.toml
```

示例：

```toml
[app]
env = "development"
database_url = "sqlite:///./data/branchat.db"
auth_token = "replace-with-a-strong-token"
master_key = "replace-with-a-stable-master-key"
timezone = "Asia/Shanghai"
```

### 2. 一条命令启动开发环境

```bash
./scripts/start.sh
```

这会同时启动：

- 后端 API：`http://127.0.0.1:8000`
- 前端控制台：`http://127.0.0.1:3001`

控制台开发模式下会把 `/api`、`/internal`、`/v1` 代理到后端服务。

### 3. 分别启动前后端

只启动后端：

```bash
./scripts/start_core.sh
```

只启动控制台开发服务器：

```bash
./scripts/start_console.sh
```

构建控制台并由 FastAPI 托管：

```bash
./scripts/build_console.sh
./scripts/start_core.sh
```

构建完成后，访问 `http://127.0.0.1:8000/` 即可打开内嵌控制台。

---

## 配置说明

配置来源优先级如下：

1. 环境变量
2. `config.toml`
3. 代码默认值

常用环境变量如下：

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `BRANCHAT_CONFIG` | 配置文件路径 | `config.toml` |
| `BRANCHAT_DATABASE_URL` | 数据库连接串 | `sqlite:///./data/branchat.db` |
| `BRANCHAT_AUTH_TOKEN` | Bearer Token | `change-me` |
| `BRANCHAT_MASTER_KEY` | 密钥加密主密钥 | `dev-master-key-change-me` |
| `BRANCHAT_LOG_DIR` | 日志目录 | `data/logs` |
| `BRANCHAT_REQUEST_TIMEOUT_SECONDS` | 上游请求超时 | `60` |
| `BRANCHAT_CACHE_TTL_SECONDS` | 网关缓存 TTL | `300` |
| `BRANCHAT_CACHE_TEMPERATURE_THRESHOLD` | 可参与缓存的温度阈值 | `0.3` |
| `BRANCHAT_FAILURE_THRESHOLD` | 端点连续失败熔断阈值 | `3` |
| `BRANCHAT_FAILURE_COOLDOWN_SECONDS` | 熔断冷却时间 | `120` |
| `BRANCHAT_DEFAULT_STRATEGY` | 默认路由策略 | `balanced` |
| `BRANCHAT_DEFAULT_TEMPERATURE` | 默认温度 | `0.2` |
| `BRANCHAT_DEFAULT_MAX_TOKENS` | 默认最大输出 Token | `1024` |
| `BRANCHAT_TIMEZONE` | 业务时区 | `Asia/Shanghai` |

启动脚本额外支持这些运行时变量：

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `HOST` | 后端监听地址 | `127.0.0.1` |
| `PORT` | 后端监听端口 | `8000` |
| `RELOAD` | `start_core.sh` 是否热重载 | `1` |
| `CORE_RELOAD` | `start.sh` 启动后端时是否热重载 | `1` |
| `DEV_PORT` | 控制台开发端口 | `3001` |
| `PROXY_TARGET` | 控制台代理的后端地址 | `http://127.0.0.1:8000` |

安全注意事项：

- `master_key` 会参与端点密钥的加解密，已有数据落库后不要随意更改。
- 除 `/internal/health` 外，绝大多数管理接口都要求 `Authorization: Bearer <auth_token>`。
- Endpoint 中保存的上游 `api_key` 会以加密形式存储，接口返回时只暴露脱敏值。

---

## 使用方式

### 作为 OpenAI-compatible 网关

配置好至少一个可用端点后，可以把 Branchat 当作统一网关使用：

- `POST /v1/chat/completions`
- `GET /v1/models`

支持的请求特性包括：

- `prompt_id` + `prompt_variables`
- `strategy`
- `endpoint_id`
- `disable_cache`
- `stream`

适合对接已有兼容 OpenAI Chat Completions 协议的客户端或 Agent。

### 作为树形会话系统

聊天能力通过 `/api/chat/*` 提供，支持：

- 创建和删除会话
- 保存会话级草稿配置
- 发送消息与流式生成
- 从历史节点分支
- 编辑节点后继续生成
- 对指定回答重新生成
- 选择回答变体
- 节点 pin / unpin
- 停止当前生成

---

## 节点交互规则

| 节点类型 | 可用操作 |
| --- | --- |
| 用户节点（叶子） | 无 |
| AI 节点（叶子） | 编辑、重新生成、从此分叉 |
| AI 节点（历史） | 从此分叉 |

只有当前 branch 指针指向的叶子节点才能继续生成；历史节点默认只用于回看和派生新分支。

---

## 上下文压缩策略

当会话超过模型窗口阈值时，Branchat 会将早期上下文压缩为摘要节点插入树中，而不是简单截断历史。

| 档位 | 窗口大小 | 触发阈值 | 压缩范围 |
| --- | --- | --- | --- |
| 小窗口 | `<= 128k` | `60%` | 前 `50%` |
| 中窗口 | `<= 256k` | `70%` | 前 `40%` |
| 大窗口 | `> 256k` | `80%` | 前 `30%` |

压缩时会跳过被 `pinned` 的节点，并将被压缩的旧节点标记为 `archived`。

---

## API 概览

| 路径 | 说明 | 鉴权 |
| --- | --- | --- |
| `GET /internal/health` | 健康检查 | 否 |
| `GET /internal/metrics` | 聚合指标 | 是 |
| `GET /internal/stats` | 趋势统计 | 是 |
| `GET /internal/logs` | 请求日志查询 | 是 |
| `POST /v1/chat/completions` | OpenAI-compatible 聊天补全 | 是 |
| `GET /v1/models` | 逻辑模型列表 | 是 |
| `GET/POST/PUT/DELETE /api/endpoints` | 模型端点管理 | 是 |
| `POST /api/endpoints/{id}/validate` | 校验端点是否可用 | 是 |
| `GET/POST/PUT/DELETE /api/prompts` | Prompt 模板管理 | 是 |
| `POST /api/prompts/{id}/preview` | Prompt 渲染预览 | 是 |
| `GET/POST/PATCH/DELETE /api/chat/conversations` | 会话管理 | 是 |
| `POST /api/chat/conversations/{id}/messages/*` | 发送、编辑、分支、重生成、流式事件 | 是 |

如果你需要更细的字段定义，可以直接查看 FastAPI OpenAPI 文档：

- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 控制台能力

`frontend/console` 是 Branchat 自带的 React 控制台，目前主要用于：

- Dashboard 概览
- Endpoint 管理
- Prompt 模板管理
- Chat 调试页
- Bearer Token 本地配置

开发模式默认地址为 `http://127.0.0.1:3001`。如果 `config.toml` 中存在 `auth_token`，控制台开发启动脚本会自动读取并注入默认 Token。

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

## 适用场景

Branchat 适合这些场景：

- 需要在主线对话之外探索多个支线问题
- 希望把一个逻辑模型映射到多个真实上游端点，并按策略路由
- 需要对 Prompt 模板做版本化管理、变量注入和在线调试
- 需要一套本地可运行、可观察、可扩展的 AI 网关与聊天控制台

---

## 相关文档

- [console README](./frontend/console/README.md)
- [chatbot-branch-design](./docs/chatbot-branch-design.md)
- [branchat-compression-refactor](./docs/branchat-compression-refactor.md)

---

## 协议

MIT License © Branchat
