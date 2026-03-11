# AetherGate-Lite

`AetherGate-Lite` 是一个面向个人用户的轻量多模型网关，基于 `Python 3.12 + FastAPI + SQLite`，提供统一的 OpenAI 兼容入口、基础 Prompt 模板、双 Provider 接入、轻量缓存和基础观测能力。

## 当前能力

- 单用户 Bearer Token 鉴权
- `POST /v1/chat/completions`
- `GET /v1/models`
- `GET /internal/health`
- `GET /internal/metrics`
- `GET /internal/stats`
- `GET /internal/logs`
- `GET/POST/PUT/DELETE /api/endpoints`
- `POST /api/endpoints/{id}/validate`
- `PUT /api/endpoints/{id}/enabled`
- `GET/POST/PUT/DELETE /api/prompts`
- `POST /api/prompts/{id}/preview`
- Provider: `openai_compatible`、`ollama`

## 目录结构

```text
app/
  api/            FastAPI 路由层
  core/           配置、鉴权、日志、安全
  db/             数据库基建
  models/         SQLAlchemy 模型
  providers/      Provider 适配器
  repositories/   数据访问层
  schemas/        Pydantic schema
  services/       网关主链路、路由、缓存、观测
tests/            最小闭环测试
config.example.toml
```

## 配置

默认使用 `config.toml`，环境变量会覆盖配置文件。可复制示例：

```bash
cp config.example.toml config.toml
```

关键配置：

- `AETHERGATE_DATABASE_URL`
- `AETHERGATE_AUTH_TOKEN`
- `AETHERGATE_MASTER_KEY`
- `AETHERGATE_CACHE_TTL_SECONDS`
- `AETHERGATE_CACHE_TEMPERATURE_THRESHOLD`

`master_key` 用于本地加密 endpoint API Key，数据库不保存明文。

## 启动

### 同时启动前后端

推荐直接使用：

```bash
./scripts/start.sh
```

脚本会同时启动并维护：

- FastAPI 后端
- Vite 前端开发服务器

默认地址：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:3001`

全栈模式可选环境变量：

```bash
HOST=0.0.0.0 PORT=8000 DEV_PORT=3001 CORE_RELOAD=0 ./scripts/start.sh
```

### 只启动后端

推荐直接使用：

```bash
./scripts/start_core.sh
```

脚本行为：

- 优先使用 `uv` 创建和复用 `.venv`
- 如果本机没有 `uv`，自动回退到 `python3 -m venv`
- 首次启动会自动从 `config.example.toml` 生成 `config.toml`
- 缺依赖时自动执行 `pip install -e .`

可选环境变量：

```bash
HOST=0.0.0.0 PORT=8000 RELOAD=0 ./scripts/start_core.sh
```

默认地址：`http://127.0.0.1:8000`

### 启动控制台

构建后由 FastAPI 直接托管：

```bash
./scripts/build_console.sh
./scripts/start_core.sh
```

启动后可直接打开：

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/docs`

如果是前端开发模式，单独启动 Vite：

```bash
./scripts/start_console.sh
```

默认开发地址：`http://127.0.0.1:3001`
默认通过 Vite 代理转发到 `http://127.0.0.1:8000`
如果根目录存在 `config.toml`，脚本会自动读取其中的 `auth_token` 注入前端开发会话。

## 鉴权

除 `GET /internal/health` 外，其余接口默认都要求 Bearer Token：

```http
Authorization: Bearer change-me
```

生产环境请修改 `config.toml` 或环境变量中的 `auth_token` 和 `master_key`。

## 最小闭环

1. 创建 endpoint
2. 创建 Prompt 模板
3. 调用 `/v1/chat/completions`
4. 查看 `/internal/logs`、`/internal/metrics`、`/internal/stats`

示例 endpoint 创建：

```bash
curl -X POST http://127.0.0.1:8000/api/endpoints \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "local-openai",
    "provider_type": "openai_compatible",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-xxx",
    "model_name": "gpt-4o-mini",
    "logical_model": "gpt-lite",
    "priority": 10,
    "weight": 1
  }'
```

示例 Prompt 创建：

```bash
curl -X POST http://127.0.0.1:8000/api/prompts \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_id": "assistant.default",
    "name": "默认助手",
    "content": "你是一个回答简洁的助手，当前用户是 {name}。",
    "variables": ["name"]
  }'
```

示例对话请求：

```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-lite",
    "temperature": 0.2,
    "prompt_id": "assistant.default",
    "prompt_variables": {"name": "Cai"},
    "messages": [{"role": "user", "content": "介绍一下你自己"}]
  }'
```

## 测试

```bash
.venv/bin/pytest
```

前端测试与构建：

```bash
cd frontend/console
npm run test
npm run build
```
