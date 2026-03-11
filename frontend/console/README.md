# AetherGate-Lite Console

这是从旧 `AetherGate` 控制台裁剪迁移过来的 React + Vite 前端，当前只保留 Lite 版本仍然支持的能力：

- Dashboard 概览
- Endpoint 管理
- Prompt 模板管理
- Chat 调试页
- Bearer Token 本地配置

## 开发

```bash
cd frontend/console
npm install
npm run dev
```

默认开发地址：`http://127.0.0.1:3001`

Vite 会把 `/api`、`/internal`、`/v1` 代理到 `http://127.0.0.1:8000`。

## 构建

```bash
cd frontend/console
npm run build
```

构建产物会输出到 `frontend/console/dist`，随后可由 FastAPI 根路径 `/` 直接托管。

## 测试

```bash
cd frontend/console
npm run test
```
