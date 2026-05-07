# Branchat Notebook Redesign — UI 升级 + Phase 4 差异化功能

- 日期：2026-05-07
- 状态：草案待评审
- 范围：前端为主（约 95% 工作量），后端 1 处字段微调
- 决策路径：见会话记录 § 1–§ 7

---

## 目标

把 Chat 页升级为"作品级别"的视觉与体验，把 Branchat 唯一的差异化（树形对话）从"功能"提升到"页面视觉主角"。同时给全局外壳（topbar / sidebar / 主题）和共享控件套上一致的设计语言，让其他页面（Endpoints / Prompts / Dashboard）"安静地一致"。

## 非目标

- 移动端原生体验（仅最小可读，不做 mobile-first）
- 视觉回归测试 / E2E
- 国际化（仍 zh-only）
- 键盘快捷键体系
- README GIF（独立任务，本次不做）
- Phase 4 列表里的"分叉首次引导"和"stale 悬停解释"——按 A 档跳过
- 删除 endpoint 的 `quality_score` / `input_cost_per_1k` / `output_cost_per_1k` 字段

---

## 视觉方向：Warm Research Notebook

米白纸张 + 墨色文本 + 沙色 / 苔藓两个低饱和 accent。serif italic 用作章节标题、品牌、引语，制造"思考工具"的气质。Light-only，**砍掉深色模式**。

具体调色板：

| Token | Hex | 用途 |
|---|---|---|
| `--paper` | `#faf7f2` | 主背景，Chat 阅读区 |
| `--paper-shade` | `#f3eee2` | 控制面板背景、收起态侧栏 |
| `--paper-warm` | `#f8f4ea` | topbar、侧栏、subtle 高亮区 |
| `--surface-card` | `#ffffff` | 浮起卡片、对话框 |
| `--ink` | `#2c2519` | 主文本、标题 |
| `--ink-soft` | `#6b5d44` | 副标、衬线斜体段、说明 |
| `--ink-faint` | `#a89880` | 三级文字、placeholder、stale 节点 |
| `--rule` | `#e8dfce` | 边框、分割线 |
| `--rule-soft` | `#efe8d9` | 次级分割线 |
| `--sand` | `#94785a` | 分叉按钮、当前节点、primary action |
| `--sand-hover` | `#7d6648` | primary 按钮悬停 |
| `--moss` | `#7d9477` | summary 节点、压缩相关 UI |
| `--terracotta` | `#c08768` | 警告 / 错误（极少使用） |

字体栈：

| Token | Stack | 用途 |
|---|---|---|
| `--font-serif` | `"Iowan Old Style", "Source Serif 4", Georgia, serif` | 标题、品牌、章节、引语 |
| `--font-sans` | `ui-sans-serif, "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | 正文、按钮、表单 |
| `--font-mono` | `ui-monospace, "SF Mono", "Menlo", "JetBrains Mono", monospace` | 代码、ID、模型名 |

**不引入外部 web font**——零网络依赖、零 FOUC、加载更快。

间距：沿用 Tailwind 4px 网格。阅读区主区 padding `9 (36px)`，消息间 gap `4-5 (16-20px)`，控件内 padding `2 (8px)`。

圆角：`none / sm:4 / md:6 / lg:8 / xl:12 / pill:100px`。输入控件 sm-md，卡片 lg，对话框 xl，分叉按钮 pill。

Elevation：`flat`（仅 border）/ `hairline`（1px shadow + soft border）/ `popover`（浮起阴影）。默认 flat，弹窗用 popover。

---

## 布局：三栏可折叠

| 区域 | 展开尺寸 | 折叠尺寸 | 内容 |
|---|---|---|---|
| 左栏 | 220px 固定 | 36px 图标条 | 上方：会话列表；下方：控制面板（默认折叠成单行 summary） |
| 中间阅读区 | flex 1，最大宽 760px 居中 | — | 当前对话的可见消息序列 |
| 右栏 | 240px 固定 | 36px 图标条 | 树形检视 + Pinned 区 |

**默认状态**（首次访问 / 大屏 ≥ 1280px）：左栏展开（220px）、右栏展开（240px）、控制面板折叠为单行。

控制面板默认折叠为一行：`gpt-lite · balanced · 0.2`，点击展开为完整表单（Model / Prompt / Strategy / Temperature）。两侧栏点击列头 `⟨` / `⟩` 折叠/展开，状态持久化到 `useConsoleUiStore`。

**响应式收起**：`< 1024px` 时右栏自动收起；`< 768px` 时左栏也自动收起，但不专门做移动端体验。

---

## 全局外壳

### Topbar（高 56px）
- 背景 `paper-warm`，下方 1px `rule` 分割线
- 品牌区：`Branchat`（serif）+ `· 一个会分叉的对话`（serif italic + ink-soft）
- 导航：4 项（聊天 / 运行指标 / 入口点 / 模板），sans 字体，当前项底部 1.5px sand 下划线
- 右侧：⚙ 齿轮，点击打开 Settings dialog
- **删除主题切换 UI**

### 页面 Header 模式（所有页面通用）

```
分支与压缩讨论                       ← serif，18-20px，--ink
main · 12 nodes · 3 branches         ← serif italic，11px，--ink-faint
─────────────────────────────────────
```

- Endpoints：`Endpoints` / `12 endpoints · 3 enabled`
- Prompts：`Prompts` / `8 templates · 5 active`
- Dashboard：`运行指标` / `截至 2026-05-07 14:32 · 24 小时统计`
- Chat：当前会话名 / branch 信息

### Settings dialog
- 标题 `Settings`（serif italic）
- 内容仅一项：Bearer Token 输入 + 保存
- 不引入额外功能

---

## 组件 Primitives 策略

### 原则：Re-skin in place，Token 值替换、名字保留

不创建 v2 版本，直接改 `shared/ui/*.tsx`。不重命名既有 token，把它们的**值**指向新的 notebook 调色板：

```css
/* global.css :root */
--paper:        #faf7f2;
--paper-shade:  #f3eee2;
--ink:          #2c2519;
--ink-soft:     #6b5d44;
--sand:         #94785a;
--moss:         #7d9477;
/* ...上面表格里的所有 token */

/* 既有语义 token 重新指向 notebook 调色板 */
--background:   var(--paper);
--surface:      var(--paper-warm);
--foreground:   var(--ink);
--accent:       var(--sand);
/* ... */
```

所有现有 `bg-background` / `text-foreground` 调用点自动获得新外观，**零代码改动就能看到变化**。新代码可以用更直观的 `bg-paper` / `text-ink-soft`，两套命名共存。

### Primitive 改动清单

| 文件 | 改动 |
|---|---|
| `button.tsx` | primary variant 改沙色填充；secondary 改纸色 + ink 字 + sand border on hover；ghost 保持透明 |
| `input.tsx` | paper-warm 底 + rule 边框 + ink 字，focus 转 sand border |
| `textarea.tsx` | 同 input |
| `select.tsx` | 同 input + dropdown 用 popover elevation |
| `dialog.tsx` | 白底 + xl radius + popover shadow，标题用 serif |
| `card.tsx` | 默认 paper-warm + rule border + lg radius |
| `badge.tsx` | 新增 sand / moss / terracotta 三个语义 variant |
| `separator.tsx` | 改用 `--rule` 颜色 |
| `confirmation-dialog.tsx` | 标题加 serif，destructive 用 terracotta |
| `auth-required-state.tsx` | 视觉跟随，不深度重做 |

### 删除 dark mode 痕迹
- `global.css` 里 `.dark { ... }` 整段删除
- `app-shell.tsx` 顶部 ThemeToggle 移除
- `useConsoleUiStore` 里 theme 字段及关联逻辑清掉
- 全仓 grep `theme` / `dark:` / `useDarkMode` 一次性扫尾

### Chat 专属新组件不放 shared/ui
分支胶囊按钮、Summary 节点块、Tree 节点条、Marginalia 容器、CollapseRail 这些是 **Chat domain 专属**，放到 `features/chat/components/`。

---

## Chat 页关键状态与交互

### 消息节点 actions 显示规则

| 节点类型 | actions |
|---|---|
| AI 叶子节点（当前 branch head） | 默认显示：`⎇ 从这里分叉` (primary, sand pill) + `编辑` + `重新生成` |
| AI 历史节点 | 默认隐藏，hover 显示：`⎇ 从这里分叉` (sand outline pill) |
| User 节点 | 无 actions |
| Stale 节点 | 无 actions（read-only） |
| Summary 节点 | `展开原始内容 →` 链接 |

默认隐藏的 actions 用 120ms 淡入过渡。

### 关键状态

- **流式生成中**：assistant 行 head 显示 `streaming…`，文末闪烁 sand 光标，输入框变 disabled，旁边显示 `⏹ 停止生成`（border style，不抢戏）
- **错误**：bubble 左 border 改 terracotta，head 加 `· error`，显示 error_message + "重试"按钮
- **已停止**：文末追加灰色 "（已停止）"，无光标
- **编辑模式**：节点 text 区 → textarea，actions 改 `保存 + 继续` / `取消`
- **当前 conversation 无消息**：主区显示 serif italic "start writing…"，输入框聚焦
- **首次进入（无任何会话）**：serif 大标题 "还没有任何对话" + serif italic 箴言 "a tree begins with a single root" + sand pill "+ 开始第一个对话" + 项目特色 hint

### 滚动 / 进入动画
- 流式 token 自动 scroll 到底部（仅当用户已在底部 ±50px 内）
- 树面板与主区域高亮联动用 IntersectionObserver
- 切换 conversation 内容区淡入 80ms

---

## Phase 4 功能行为契约

### Summary 展开（行为档 B）

**用户行为**：点击 summary block 的 `展开 ↓` → 块展开为白底 + popover elevation，下方列出被压缩的原始节点（read-only）。再点 `收起 ↑` 折回。

**数据来源**：完全无新接口。

- `branch.compressed_source_versions_json` 已经是 `{node_id: version}` dict，**直接取 keys** 就是被压缩的源节点 ID 列表
- 不修改 `cached_path_json` 存储格式
- `VisibleMessageResponse` 需新增字段 `source_node_ids: list[str] | None`，summary 类条目填该列表，node 类条目填 None

**前端实现**：`chat-adapters.ts` 在转换 visible_messages 时，summary 节点带 `archivedNodeIds`。展开时用这些 ID 在 `messageNodes` 字典里查找节点对象，渲染成 read-only 列表。

**边缘情况**：
- 某 archived 节点已被删除：跳过
- `source_node_ids` 为空数组：展开按钮隐藏（兼容老数据）

### 树面板可点击跳转（行为档 B）

**交互**：
- 节点 hover：浅黄高亮 + 主区域对应消息高亮
- 节点点击：主区域 `scrollIntoView({behavior:'smooth', block:'center'})`，目标消息左侧短暂闪烁 sand 1px line（200ms fade）
- summary 节点点击：等同于"展开 summary"
- stale 节点点击：跳转 + 顶部 banner "此节点已失效，当前 branch head 在 [link]"
- archived 节点：树面板默认不展示，仅在 summary 展开时出现

**数据**：完全无新接口。从已有 `message_nodes` + `visible_messages` 推导：

```ts
type TreeNode = {
  id: string                         // virtual_id (summary) or message_id (node)
  kind: 'node' | 'summary'
  role: 'user' | 'assistant' | 'summary'
  parentId: string | null
  state: 'current' | 'sibling' | 'stale' | 'archived'
  preview: string                    // 截短的 content
  depth: number
}
```

构建（纯前端，新增 `buildTreeView`）：
1. 从当前 branch 的 `head_message_id` 沿 `parent_id` 上溯，标记 `current`
2. 在每个 fork 点（`modified_from` sibling），加入对应支线节点，标记 `sibling`
3. visible_messages 中的 summary 条目按 virtual_id 插入树
4. archived 节点默认不展示
5. `stale` 字段直接映射到 state

### 分叉按钮（行为档 A）
仅视觉。AI 叶子节点显示 sand 填充 pill，AI 历史节点 hover 显示 sand outline pill。**不做**首次访问引导。

### Stale 节点（行为档 A）
仅视觉。字色 `--ink-faint`，role 后追加 ` · stale`，无 hover actions，树面板加删除线。**不做**悬停解释、跳转当前生效版本。

---

## 后端改动总览（仅一处）

```diff
# app/schemas/chat_sessions.py
class VisibleMessageResponse:
    virtual_id: str
    kind: Literal["node", "summary"]
    role: str
    content: str
    source_node_id: str | None
+   source_node_ids: list[str] | None  # for kind="summary"
```

```diff
# app/services/chat_sessions.py — 在构建 summary 类 VisibleMessageResponse 处
+ source_node_ids = list(json.loads(branch.compressed_source_versions_json or "{}").keys())
  VisibleMessageResponse(
      virtual_id=...,
      kind="summary",
      role="summary",
      content=summary_text,
      source_node_id=None,
+     source_node_ids=source_node_ids,
  )
```

无新增表、无新 API 端点、无 schema migration。

---

## 其他页面（B 档：外壳 + 控件视觉对齐）

### 通用规则
每页自动获得：新 topbar + 导航高亮、新页面 header 模式、重新设计的 primitives、新 token 配色。

每页**不动**：现有页面布局结构、功能与表单字段、数据流与 API、ChartJS / echarts / 表格组件代码。

### Dashboard（→ "运行指标"）
- echarts palette 替换：主色 `--sand`，次色 `--moss`，第三色 `--ink-soft`，网格线 `--rule`，文字 `--ink-soft`
- 折线图填充用 sand 10% alpha；柱状图直接 sand
- 不改图表类型、布局、KPI 选指标

### Endpoints
- 状态指示（enabled / disabled / failed）：sand / ink-faint / terracotta dot 而非 badge
- "Validate" 成功反馈改成卡片右下角小字 `validated 2m ago` (serif italic)，不弹通知
- 不改卡片字段顺序、表单、保存逻辑

### Prompts
- 内容预览区改 mono 字体（已经是）+ paper-shade 背景 + rule border + lg radius
- 变量列表 chip 用 sand outline
- 不改预览渲染、启停语义、变量校验

---

## 文件结构

```
frontend/console/src/
├── app/
│   ├── styles/
│   │   └── global.css                    # ✏️ token 值替换 + 字体栈 + 删 dark
│   └── shell/
│       └── app-shell.tsx                 # ✏️ 删主题切换、添 Settings dialog 入口
├── shared/
│   └── ui/
│       ├── button.tsx                    # ✏️ 重新设计 variants
│       ├── input.tsx                     # ✏️ 重新设计
│       ├── textarea.tsx                  # ✏️ 重新设计
│       ├── select.tsx                    # ✏️ 重新设计
│       ├── dialog.tsx                    # ✏️ 重新设计
│       ├── card.tsx                      # ✏️ 重新设计
│       ├── badge.tsx                     # ✏️ 加新 variants
│       ├── separator.tsx                 # ✏️ 用新 token
│       ├── confirmation-dialog.tsx       # ✏️ 视觉跟随
│       └── settings-dialog.tsx           # ➕ 新组件
├── features/
│   ├── chat/
│   │   ├── chat-adapters.ts              # ✏️ archivedNodeIds + buildTreeView
│   │   ├── chat-adapters.test.ts         # ➕ 两组新 case
│   │   ├── chat-types.ts                 # ✏️ 新增 TreeNode / archivedNodeIds 类型
│   │   ├── pages/
│   │   │   └── chat-page.tsx             # ✏️ 重构为三栏可折叠布局
│   │   └── components/
│   │       ├── conversation-tree-panel.tsx # ✏️ 内部树视图（用 buildTreeView，专注渲染节点列表）
│   │       ├── control-panel.tsx         # ✏️ 折叠态 + 展开态
│   │       ├── message-bubble.tsx        # ✏️ 新视觉 + actions 显示规则
│   │       ├── input-area.tsx            # ✏️ 新视觉 + stop 按钮
│   │       ├── session-sidebar.tsx       # ✏️ 与 control-panel 组合到左栏
│   │       ├── branch-pill.tsx           # ➕ 新组件
│   │       ├── summary-node.tsx          # ➕ 新组件，含展开/收起
│   │       ├── tree-node.tsx             # ➕ 新组件（被 conversation-tree-panel 复用）
│   │       ├── marginalia-panel.tsx      # ➕ 右栏外层容器（列头、折叠交互、Pinned 区，内嵌 conversation-tree-panel）
│   │       └── collapse-rail.tsx         # ➕ 左/右栏共用的图标态条
│   ├── endpoints/                        # ✏️ 仅页面 header + 状态色微调
│   ├── prompts/                          # ✏️ 仅页面 header + 预览区微调
│   └── dashboard/                        # ✏️ 页面 header + echarts 配色
```

后端：

```
app/schemas/chat_sessions.py              # ✏️ VisibleMessageResponse +1 字段
app/services/chat_sessions.py             # ✏️ 构造 summary 时填 source_node_ids
```

---

## 测试

### 沿用现有测试（必须全绿）
- `pytest tests/`：26/26 通过
- `vitest run`：39/39 通过
- `tsc --noEmit`：无错误
- `vite build`：通过

### 新增测试
- `chat-adapters.test.ts`：覆盖新增的 `archivedNodeIds` 提取
- `chat-adapters.test.ts`：覆盖 `buildTreeView` 树构建（current / sibling / stale / archived 状态）

### 手动验证清单（每完成一阶段做一次）
1. Chat：发消息、流式、停止、分叉、编辑、重生、压缩触发、summary 展开、树点击跳转、左右栏折叠
2. Endpoints：增删改、启停、Validate、密钥脱敏
3. Prompts：增删改、变量预览、启停
4. Dashboard：图表渲染、时间范围切换、日志查看
5. Settings：Bearer Token 保存、刷新后保留

### 不做
- 视觉回归（无 Chromatic / Playwright 截图）
- E2E

---

## 实施路径：地基优先

按 § 4 决议走路径一。预期顺序（每个 step 一个 commit/PR）：

1. **Token 值替换 + 字体栈 + 删 dark**（仅 `global.css` 与 `app-shell.tsx` 主题相关代码）
2. **Primitive 重做**（`shared/ui/*.tsx` 全套，加 `settings-dialog.tsx`）
3. **全局外壳**（`app-shell.tsx` topbar/sidebar 视觉，加 ⚙ 入口）
4. **其他页面 header + 微调**（Endpoints / Prompts / Dashboard 三页）
5. **Chat 页布局重构**（`chat-page.tsx` 三栏可折叠 + control-panel 折叠态 + collapse-rail）
6. **Chat 页节点视觉**（`message-bubble.tsx` + `branch-pill.tsx` + actions 显示规则 + stale / streaming / 错误状态）
7. **Phase 4 功能**（后端 schema 改动 + `summary-node.tsx` 展开 + `buildTreeView` + 树面板交互）
8. **空状态 + 收尾**（empty state 文案、stale banner、ChartJS 配色）

每步独立可回滚。前 4 步是"地基 + 其他页面自动跟随"，第 5-8 步是 Chat 页主战场。

---

## 风险与开放问题

| 风险 | 处理 |
|---|---|
| 现有页面隐性依赖被改值的 token | 用 alias 保留旧名（`--background` → `var(--paper)`），不强删 |
| dark mode 状态字段清理可能漏掉调用点 | grep `theme` / `dark:` / `useDarkMode` 一次性扫尾 |
| echarts 配色对比度不够 | 实施时跑浏览器，必要时把 sand 加深一档 |
| Iowan Old Style 在 Linux/Windows 实际效果 | fallback 到 Source Serif 4 / Georgia，验收时在 Linux 上扫一眼 |
| 三栏布局窄屏可读性 | `< 1024px` 自动收右栏；`< 768px` 自动收左栏；不专门做移动端 |
| `_message_version` 可能不匹配解码 `compressed_source_versions_json` 的 key 类型 | 实施时确认 dict key 是 str（json 反序列化默认 str），与 message_id 类型一致 |
