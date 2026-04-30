# 运行与部署

本文记录 Branchat 的配置项、启动脚本、安全细节与部署相关内容。日常使用请先看根目录 [README](../README.md)。

---

## 配置来源优先级

1. 环境变量
2. `config.toml`
3. 代码默认值

项目根目录提供 `config.example.toml`。如果直接运行启动脚本，缺失的 `config.toml` 会自动创建。

---

## 常用环境变量

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `BRANCHAT_CONFIG` | 配置文件路径 | `config.toml` |
| `BRANCHAT_DATABASE_URL` | 数据库连接串 | `sqlite:///./data/branchat.db` |
| `BRANCHAT_AUTH_TOKEN` | Bearer Token | `change-me` |
| `BRANCHAT_MASTER_KEY` | 密钥加密主密钥 | `dev-master-key-change-me` |
| `BRANCHAT_LOG_DIR` | 日志目录 | `data/logs` |
| `BRANCHAT_REQUEST_TIMEOUT_SECONDS` | 上游请求超时 | `60` |
| `BRANCHAT_FAILURE_THRESHOLD` | 端点连续失败熔断阈值 | `3` |
| `BRANCHAT_FAILURE_COOLDOWN_SECONDS` | 熔断冷却时间 | `120` |
| `BRANCHAT_DEFAULT_STRATEGY` | 默认路由策略 | `balanced` |
| `BRANCHAT_DEFAULT_TEMPERATURE` | 默认温度 | `0.2` |
| `BRANCHAT_DEFAULT_MAX_TOKENS` | 默认最大输出 Token | `1024` |
| `BRANCHAT_TIMEZONE` | 业务时区 | `Asia/Shanghai` |

---

## 启动脚本变量

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `HOST` | 后端监听地址 | `127.0.0.1` |
| `PORT` | 后端监听端口 | `8000` |
| `RELOAD` | `start_core.sh` 是否热重载 | `1` |
| `CORE_RELOAD` | `start.sh` 启动后端时是否热重载 | `1` |
| `DEV_PORT` | 控制台开发端口 | `3001` |
| `PROXY_TARGET` | 控制台代理的后端地址 | `http://127.0.0.1:8000` |

---

## 启动方式

### 一键启动（开发模式）

```bash
./scripts/start.sh
```

同时启动后端 (`:8000`) 与前端 (`:3001`)。控制台开发模式会把 `/api`、`/internal`、`/v1` 代理到后端。

### 只启动后端

```bash
./scripts/start_core.sh
```

### 只启动控制台开发服务器

```bash
./scripts/start_console.sh
```

如果 `config.toml` 里设置了 `auth_token`，启动脚本会自动读取并注入控制台默认 Token。

### 构建控制台并由 FastAPI 托管

```bash
./scripts/build_console.sh
./scripts/start_core.sh
```

构建完成后访问 `http://127.0.0.1:8000/` 即可打开内嵌控制台。

---

## 配置示例

```toml
[app]
env = "development"
database_url = "sqlite:///./data/branchat.db"
auth_token = "replace-with-a-strong-token"
master_key = "replace-with-a-stable-master-key"
timezone = "Asia/Shanghai"
```

---

## 安全注意事项

- `master_key` 参与端点 API Key 的加解密，**已有数据落库后不要随意更改**，否则旧端点的密钥将无法解密。
- 除 `/internal/health` 外，所有管理与业务接口都要求 `Authorization: Bearer <auth_token>`。
- Endpoint 中保存的上游 `api_key` 以加密形式存储，接口返回时只暴露脱敏值。
- 控制台本地存储 Bearer Token，部署到公网前请确认浏览器存储域受信。

---

## 控制台

`frontend/console` 是 Branchat 自带的 React 控制台，主要用于：

- Chat 调试与树形对话操作
- Endpoint 管理
- Prompt 模板管理
- Bearer Token 本地配置
- Dashboard 运行指标

开发模式默认地址 `http://127.0.0.1:3001`。详见 [console README](../frontend/console/README.md)。
