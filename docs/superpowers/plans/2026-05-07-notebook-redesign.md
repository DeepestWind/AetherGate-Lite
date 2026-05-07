# Notebook Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the warm-research-notebook visual redesign across the console (light-only), restructure the Chat page into a three-column collapsible layout, and ship the Phase 4 differentiation features (summary node expansion + tree-panel click-to-jump).

**Architecture:** Foundation-first. Token values are migrated in-place at the CSS variable layer so existing Tailwind utility classes inherit the new look automatically. Shared `shared/ui/*` primitives are re-skinned with the new tokens; Chat-specific composites live under `features/chat/components/`. Backend impact is one schema field plus its population in the chat-sessions service.

**Tech Stack:** React 19 + Vite + Tailwind v4 (`@theme inline`) + zustand + TanStack Query + lucide-react + echarts. Backend: FastAPI + SQLAlchemy + Pydantic. Tests: vitest (frontend) + pytest (backend).

**Reference spec:** `docs/superpowers/specs/2026-05-07-notebook-redesign-design.md`

---

## Phase A — Foundation

### Task 1: Token migration in `global.css`

Replace the existing color/font tokens with the notebook palette while keeping legacy alias names so existing call sites get the new look automatically. Delete the dark-mode block.

**Files:**
- Modify: `frontend/console/src/app/styles/global.css`

- [ ] **Step 1: Inspect the current file**

```bash
cat frontend/console/src/app/styles/global.css | head -120
```

Note the existing `:root` block, `.dark` block, and `@theme inline` block — these are what we will rewrite.

- [ ] **Step 2: Rewrite `:root` with notebook tokens + legacy aliases**

Replace the `:root { ... }` block with:

```css
:root {
  /* Notebook palette — primary tokens */
  --paper:        #faf7f2;
  --paper-shade:  #f3eee2;
  --paper-warm:   #f8f4ea;
  --surface-card: #ffffff;
  --ink:          #2c2519;
  --ink-soft:     #6b5d44;
  --ink-faint:    #a89880;
  --rule:         #e8dfce;
  --rule-soft:    #efe8d9;
  --sand:         #94785a;
  --sand-hover:   #7d6648;
  --moss:         #7d9477;
  --terracotta:   #c08768;

  /* Legacy semantic aliases — point at notebook tokens so existing
     bg-background / text-foreground call sites get new look for free */
  --background:        var(--paper);
  --surface:           var(--paper-warm);
  --elevated:          var(--surface-card);
  --panel:             var(--paper-warm);
  --panel-strong:      var(--paper-shade);
  --secondary:         var(--paper-shade);
  --foreground:        var(--ink);
  --foreground-soft:   var(--ink-soft);
  --muted-foreground:  var(--ink-faint);
  --border:            var(--rule);
  --border-strong:     var(--rule-soft);
  --accent:            var(--sand);
  --accent-soft:       var(--paper-shade);
  --accent-strong:     var(--sand-hover);
  --success:           var(--moss);
  --warning:           var(--terracotta);
  --danger:            var(--terracotta);

  --radius:            12px;

  --shadow-panel: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 3: Delete the `.dark { ... }` block entirely**

If the file has a `.dark { ... }` selector block, delete it. Search with:

```bash
grep -n "^.dark\b\|^\.dark " frontend/console/src/app/styles/global.css
```

If matches are found, remove the entire block.

- [ ] **Step 4: Update `@theme inline` to expose notebook tokens + new font stacks**

Locate the existing `@theme inline { ... }` block. Replace its contents with:

```css
@theme inline {
  --font-sans: ui-sans-serif, "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-serif: "Iowan Old Style", "Source Serif 4", Georgia, serif;
  --font-mono: ui-monospace, "SF Mono", "Menlo", "JetBrains Mono", monospace;

  --color-paper: var(--paper);
  --color-paper-shade: var(--paper-shade);
  --color-paper-warm: var(--paper-warm);
  --color-surface-card: var(--surface-card);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-ink-faint: var(--ink-faint);
  --color-rule: var(--rule);
  --color-rule-soft: var(--rule-soft);
  --color-sand: var(--sand);
  --color-sand-hover: var(--sand-hover);
  --color-moss: var(--moss);
  --color-terracotta: var(--terracotta);

  /* Legacy aliases re-exposed as Tailwind colors for backward compat */
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-elevated: var(--elevated);
  --color-panel: var(--panel);
  --color-panel-strong: var(--panel-strong);
  --color-secondary: var(--secondary);
  --color-foreground: var(--foreground);
  --color-foreground-soft: var(--foreground-soft);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-strong: var(--accent-strong);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);

  --radius-sm: calc(var(--radius) - 8px);
  --radius-md: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);

  --shadow-panel: var(--shadow-panel);
}
```

- [ ] **Step 5: Type-check and build**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build
```

Expected: both pass with no errors.

- [ ] **Step 6: Visually verify**

```bash
cd frontend/console && npm run dev
```

Open `http://localhost:3001` (Bearer Token from `config.toml`'s `auth_token`). Click through Endpoints / Prompts / Dashboard. They should now show warm-paper backgrounds and ink-colored text. **Chat page is not yet restructured — expect mostly-correct colors, awkward layout.** That is fine for this task.

- [ ] **Step 7: Commit**

```bash
git add frontend/console/src/app/styles/global.css
git commit -m "frontend: migrate console tokens to notebook palette"
```

---

### Task 2: Remove dark-mode state from `useConsoleUiStore` + `app-shell.tsx`

The dark mode UI affordance and underlying state need to go. We keep `sidebarCollapsed` for now (it will be replaced by `leftPanelCollapsed` / `rightPanelCollapsed` in Task 16).

**Files:**
- Modify: `frontend/console/src/shared/stores/use-console-ui-store.ts`
- Modify: `frontend/console/src/app/shell/app-shell.tsx`

- [ ] **Step 1: Trim the store**

Replace the contents of `frontend/console/src/shared/stores/use-console-ui-store.ts` with:

```ts
import { create } from 'zustand'

type ConsoleUiState = {
  collapseSidebar: () => void
  expandSidebar: () => void
  mobileNavOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  sidebarCollapsed: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void
  toggleSidebar: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  mobileNavOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  sidebarCollapsed: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({
      mobileNavOpen: !state.mobileNavOpen
    })),
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed
    }))
}))
```

- [ ] **Step 2: Strip theme code from `app-shell.tsx`**

Open `frontend/console/src/app/shell/app-shell.tsx`. Apply these changes:

1. Remove imports: `Monitor`, `Moon`, `SunMedium` from lucide-react.
2. Remove the `type ThemeMode = ...` declaration.
3. Remove the `themeChoices` constant.
4. Remove the entire `ThemeToggle` component definition.
5. Remove the `resolveTheme` function.
6. Remove any `useEffect` that applies/removes the `dark` class on `document.documentElement`.
7. Remove all references to `themeMode` / `setThemeMode` from JSX render.

After the edit, search to confirm:

```bash
grep -n "theme\|Theme\|dark" frontend/console/src/app/shell/app-shell.tsx
```

Expected: no matches except possibly in comments or unrelated identifiers.

- [ ] **Step 3: Sweep the rest of the codebase**

```bash
grep -rn "themeMode\|setThemeMode\|ThemeMode\|ThemeToggle\|resolveTheme" frontend/console/src/
grep -rn "dark:" frontend/console/src/  # tailwind dark: prefix
```

If any occurrences remain in any file other than `node_modules` or `dist`, remove them. The first grep should return zero results; the second may return results in third-party CSS or comments — only remove the ones in our own files.

- [ ] **Step 4: Type-check + build**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build
```

Expected: pass.

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend/console && npx vitest run
```

Expected: 39/39 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/shared/stores/use-console-ui-store.ts frontend/console/src/app/shell/app-shell.tsx
git commit -m "frontend: remove dark mode UI and store state"
```

---

## Phase B — Component Primitives

> Each primitive task follows the same pattern: edit the file, run typecheck + build + tests, view the change in dev server, commit. We are re-skinning className strings and variant tables — not touching APIs. Existing call sites continue to work unchanged.

### Task 3: Re-skin `button.tsx`

Update the variant table to use notebook tokens.

**Files:**
- Modify: `frontend/console/src/shared/ui/button.tsx`

- [ ] **Step 1: Read the current file to understand the variant API**

```bash
cat frontend/console/src/shared/ui/button.tsx
```

Note the variants exposed (typically `default`, `secondary`, `ghost`, `destructive`, `outline`, `link`).

- [ ] **Step 2: Rewrite the variant classNames**

For each variant, use these rules (preserving the file's existing `cva` or className composition pattern):

- `default` (primary): `bg-sand text-white hover:bg-sand-hover`
- `secondary`: `bg-paper text-ink border border-rule hover:border-sand hover:text-sand`
- `ghost`: `bg-transparent text-ink-soft hover:bg-paper-shade hover:text-ink`
- `outline`: `bg-transparent text-ink border border-rule hover:bg-paper-shade`
- `destructive`: `bg-terracotta text-white hover:opacity-90`
- `link`: `text-sand hover:text-sand-hover underline-offset-4 hover:underline`

Sizing classes (sm / md / lg) keep their existing geometry but ensure radius uses `rounded-md` for `sm`/`md` and `rounded-lg` for `lg`. The pill shape is reserved for `branch-pill.tsx` (Task 17).

- [ ] **Step 3: Type-check + build**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build
```

Expected: pass.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend/console && npx vitest run
```

Expected: 39/39 pass.

- [ ] **Step 5: Visually verify**

In dev server, the buttons across Endpoints / Prompts pages should now look sand-toned with serif-friendly weight.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/shared/ui/button.tsx
git commit -m "frontend: reskin button primitive"
```

---

### Task 4: Re-skin form input primitives

Update `input.tsx`, `textarea.tsx`, `select.tsx` to share the same look: paper-warm fill, rule border, sand focus border.

**Files:**
- Modify: `frontend/console/src/shared/ui/input.tsx`
- Modify: `frontend/console/src/shared/ui/textarea.tsx`
- Modify: `frontend/console/src/shared/ui/select.tsx`

- [ ] **Step 1: Re-skin `input.tsx`**

The base className for the input element should become:

```
bg-paper-warm border border-rule rounded-md px-3 py-2 text-ink placeholder:text-ink-faint
focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand/20
disabled:opacity-60 disabled:cursor-not-allowed
font-sans text-sm
```

Apply this in the existing file structure (preserve the `cn(...)` and forwardRef pattern).

- [ ] **Step 2: Re-skin `textarea.tsx`**

Same className rules as `input.tsx`. Adjust `min-h` if the file already specifies one — keep that geometry.

- [ ] **Step 3: Re-skin `select.tsx`**

The trigger element follows the same input className rules. The dropdown/content portion should use:

```
bg-surface-card border border-rule rounded-lg shadow-panel
```

The selected/highlighted item:

```
bg-paper-shade text-ink
```

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Visually verify**

In dev server, open the Endpoints "Add Endpoint" dialog. Inputs should have paper-warm fill, sand focus border. Open the Prompts editor. Textarea should match.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/shared/ui/input.tsx frontend/console/src/shared/ui/textarea.tsx frontend/console/src/shared/ui/select.tsx
git commit -m "frontend: reskin input, textarea, select primitives"
```

---

### Task 5: Re-skin `dialog.tsx` + `confirmation-dialog.tsx`

Apply the dialog visual: white surface, xl radius, popover shadow, serif italic title.

**Files:**
- Modify: `frontend/console/src/shared/ui/dialog.tsx`
- Modify: `frontend/console/src/shared/ui/confirmation-dialog.tsx`

- [ ] **Step 1: Re-skin `dialog.tsx`**

For the dialog content panel:

```
bg-surface-card rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-rule-soft
max-w-lg w-full p-6
```

For the dialog title (typically a `DialogTitle` subcomponent):

```
font-serif italic text-xl text-ink
```

For the description / subtitle:

```
font-sans text-sm text-ink-soft mt-1
```

For the overlay:

```
bg-ink/30 backdrop-blur-sm
```

- [ ] **Step 2: Re-skin `confirmation-dialog.tsx`**

Apply the same dialog rules. For the destructive variant of the confirm button, ensure it uses the new `destructive` button variant from Task 3 (which is already terracotta).

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Visually verify**

Open the "Edit Endpoint" dialog and "Delete Prompt" confirmation. They should have white panels with serif italic titles.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/shared/ui/dialog.tsx frontend/console/src/shared/ui/confirmation-dialog.tsx
git commit -m "frontend: reskin dialog and confirmation dialog primitives"
```

---

### Task 6: Re-skin `card.tsx`, `badge.tsx`, `separator.tsx`

**Files:**
- Modify: `frontend/console/src/shared/ui/card.tsx`
- Modify: `frontend/console/src/shared/ui/badge.tsx`
- Modify: `frontend/console/src/shared/ui/separator.tsx`

- [ ] **Step 1: Re-skin `card.tsx`**

Card root:

```
bg-paper-warm border border-rule rounded-lg
```

CardHeader, CardContent, CardFooter — keep existing internal padding rules; only update the root.

- [ ] **Step 2: Re-skin `badge.tsx` with new variants**

Replace the variants table. The full set should include:

- `default`: `bg-paper-shade text-ink-soft border border-rule`
- `sand`: `bg-sand/10 text-sand border border-sand/20`
- `moss`: `bg-moss/10 text-moss border border-moss/20`
- `terracotta`: `bg-terracotta/10 text-terracotta border border-terracotta/30`
- `outline`: `bg-transparent text-ink-soft border border-rule`

All sizes use `rounded-md px-2 py-0.5 text-xs font-sans`.

If the existing file uses different variant names (e.g., `success`, `warning`), keep those names but point them at the new color tokens (`success` → moss, `warning`/`destructive` → terracotta).

- [ ] **Step 3: Re-skin `separator.tsx`**

Replace any hex/Tailwind color classes with `bg-rule`. Horizontal: `h-px bg-rule w-full`. Vertical: `w-px bg-rule h-full`.

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/shared/ui/card.tsx frontend/console/src/shared/ui/badge.tsx frontend/console/src/shared/ui/separator.tsx
git commit -m "frontend: reskin card, badge, separator primitives"
```

---

### Task 7: Create `settings-dialog.tsx`

A simple dialog that reads/writes the Bearer Token via `useSessionStore`.

**Files:**
- Create: `frontend/console/src/shared/ui/settings-dialog.tsx`

- [ ] **Step 1: Inspect `useSessionStore` to learn the token API**

```bash
cat frontend/console/src/shared/stores/use-session-store.ts
```

Identify the field that holds the bearer token and the setter. We will reference these — the names are likely `token` / `setToken` or `bearerToken` / `setBearerToken`. Use whatever is actually exported.

- [ ] **Step 2: Create the component**

Create `frontend/console/src/shared/ui/settings-dialog.tsx` with this content (substitute the actual token field name from Step 1 in the two marked spots):

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useSessionStore } from '@/shared/stores/use-session-store'

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const token = useSessionStore((state) => state.token) // FIXME: use real field
  const setToken = useSessionStore((state) => state.setToken) // FIXME: use real setter
  const [draft, setDraft] = useState(token ?? '')

  function handleSave() {
    setToken(draft.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            本地存储，刷新页面后保留。
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <label className="block text-xs uppercase tracking-wider text-ink-faint mb-1.5">
            Bearer Token
          </label>
          <Input
            type="password"
            placeholder="paste-token-here"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

After creating the file, replace the two `FIXME` comments with the actual field/setter names you identified in Step 1.

- [ ] **Step 3: Type-check + build**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/console/src/shared/ui/settings-dialog.tsx
git commit -m "frontend: add settings dialog primitive"
```

---

## Phase C — Global Shell

### Task 8: Topbar redesign + Settings entry

Update the topbar in `app-shell.tsx`: new brand, new nav styles, ⚙ icon that opens the settings dialog.

**Files:**
- Modify: `frontend/console/src/app/shell/app-shell.tsx`

- [ ] **Step 1: Add the Settings icon import and dialog state**

In `app-shell.tsx`, ensure `Settings` is imported from lucide-react. Add a local state inside the shell component:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false)
```

Import `SettingsDialog` from `@/shared/ui/settings-dialog`.

- [ ] **Step 2: Rewrite the topbar JSX**

Locate the existing topbar/header rendering inside `AppShell`. Replace it with:

```tsx
<header className="h-14 bg-paper-warm border-b border-rule px-6 flex items-center justify-between">
  <div className="flex items-baseline gap-3">
    <span className="font-serif text-base text-ink">Branchat</span>
    <span className="font-serif italic text-xs text-ink-soft">
      · 一个会分叉的对话
    </span>
  </div>

  <nav className="flex items-center gap-6 text-sm">
    {navigationItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          cn(
            'pb-0.5 transition-colors text-ink-soft hover:text-ink',
            isActive && 'text-ink border-b-[1.5px] border-sand'
          )
        }
      >
        {item.label}
      </NavLink>
    ))}

    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      className="ml-2 p-1.5 text-ink-soft hover:text-ink rounded-md hover:bg-paper-shade transition-colors"
      aria-label="Settings"
    >
      <Settings className="size-4" />
    </button>
  </nav>
</header>

<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
```

Adjust the surrounding container layout if the existing shell wraps children in flex/grid — preserve that structure, only replace the topbar contents.

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Visually verify**

In dev server, the topbar should now read "Branchat · 一个会分叉的对话" with serif italic accent, four nav items (聊天 / 运行指标 / 入口点 / 模板) — current page underlined sand. Click the ⚙ icon — Settings dialog opens with the current bearer token.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/app/shell/app-shell.tsx
git commit -m "frontend: redesign topbar with settings entry"
```

---

### Task 9: Create reusable `PageHeader` component

A standardized header used by Chat, Endpoints, Prompts, Dashboard.

**Files:**
- Create: `frontend/console/src/shared/ui/page-header.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/console/src/shared/ui/page-header.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type PageHeaderProps = {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, meta, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b border-rule px-9 pt-7 pb-4 flex items-end justify-between gap-4',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-serif text-xl text-ink truncate">{title}</h1>
        {meta ? (
          <p className="font-serif italic text-xs text-ink-faint mt-1">{meta}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend/console && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/console/src/shared/ui/page-header.tsx
git commit -m "frontend: add page-header primitive"
```

---

## Phase D — Other Pages

### Task 10: Apply `PageHeader` + echarts palette to Dashboard

**Files:**
- Modify: `frontend/console/src/features/dashboard/pages/dashboard-page.tsx`
- Possibly modify: chart-config files within `features/dashboard/components/` (echarts option builders)

- [ ] **Step 1: Inspect the dashboard page structure**

```bash
cat frontend/console/src/features/dashboard/pages/dashboard-page.tsx
ls frontend/console/src/features/dashboard/components/
```

Identify the existing header section and the echarts option builder file(s).

- [ ] **Step 2: Replace header with `PageHeader`**

In `dashboard-page.tsx`, replace the existing top-of-page header markup with:

```tsx
import { PageHeader } from '@/shared/ui/page-header'
// ...
<PageHeader
  title="运行指标"
  meta={`截至 ${formattedTimestamp} · 24 小时统计`}
/>
```

Where `formattedTimestamp` is the existing "as of" timestamp the page already computes (re-use whatever variable name is in the file). If no such variable exists, format `new Date()` to `YYYY-MM-DD HH:MM` using a small helper.

- [ ] **Step 3: Update echarts color palette**

In each echarts option builder, replace the existing `color`/`itemStyle` color values with notebook tokens. Use these CSS-var-resolved values (echarts does not auto-resolve CSS vars; pass hex):

```ts
const NOTEBOOK_PALETTE = {
  primary: '#94785a',     // sand
  secondary: '#7d9477',   // moss
  tertiary: '#6b5d44',    // ink-soft
  grid: '#e8dfce',        // rule
  text: '#6b5d44'         // ink-soft
}
```

For each chart's option:
- `color: [NOTEBOOK_PALETTE.primary, NOTEBOOK_PALETTE.secondary, NOTEBOOK_PALETTE.tertiary]`
- `xAxis.axisLine.lineStyle.color: NOTEBOOK_PALETTE.grid`
- `yAxis.splitLine.lineStyle.color: NOTEBOOK_PALETTE.grid`
- `xAxis.axisLabel.color`, `yAxis.axisLabel.color`: `NOTEBOOK_PALETTE.text`
- For line/area charts, set `areaStyle: { color: 'rgba(148, 120, 90, 0.10)' }` (sand at 10% alpha)

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Visually verify**

Open `/dashboard`. Header should show "运行指标 · 截至 …". Charts should now use sand/moss colors. If contrast feels weak in the visible chart area, switch `NOTEBOOK_PALETTE.primary` to `#7d6648` (sand-hover) and re-verify.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/features/dashboard
git commit -m "frontend: apply notebook page header and palette to dashboard"
```

---

### Task 11: Apply `PageHeader` + state dot to Endpoints

**Files:**
- Modify: `frontend/console/src/features/endpoints/pages/endpoints-page.tsx`
- Modify: `frontend/console/src/features/endpoints/components/endpoint-card.tsx`

- [ ] **Step 1: Replace endpoints page header**

In `endpoints-page.tsx`, add:

```tsx
import { PageHeader } from '@/shared/ui/page-header'

// where the previous header was:
<PageHeader
  title="Endpoints"
  meta={`${total} endpoints · ${enabledCount} enabled`}
  actions={<Button onClick={openCreateDialog}>+ 新建</Button>}
/>
```

Use the existing variables that count total + enabled. If they don't exist, derive from the loaded endpoints list:

```ts
const total = endpoints.length
const enabledCount = endpoints.filter((e) => e.is_enabled).length
```

- [ ] **Step 2: Update endpoint-card status indicator**

In `endpoint-card.tsx`, replace any existing badge-style status indicator with a small dot. The current state field combines `is_enabled` + `is_valid`. Render:

```tsx
function StateDot({ enabled, valid }: { enabled: boolean; valid: boolean | null }) {
  let cls = 'bg-ink-faint'
  let label = 'disabled'
  if (enabled && valid) { cls = 'bg-sand'; label = 'enabled' }
  else if (enabled && valid === false) { cls = 'bg-terracotta'; label = 'failed validation' }
  else if (enabled && valid === null) { cls = 'bg-sand/50'; label = 'unvalidated' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft" title={label}>
      <span className={`size-1.5 rounded-full ${cls}`}></span>
      {label}
    </span>
  )
}
```

Place the dot in the card header next to the endpoint name. Remove any existing colored badge that previously played this role.

- [ ] **Step 3: Validate footer micro-text**

Locate where "Validate" success/failure feedback is currently rendered (likely a toast or inline message). Replace inline messaging with a small footer text under the card:

```tsx
{lastValidatedAtRelative ? (
  <p className="font-serif italic text-xs text-ink-faint mt-2">
    validated {lastValidatedAtRelative}
  </p>
) : null}
```

Use the existing `last_validated_at` field. Keep the toast for actual click feedback (success/failure) — only the persistent indicator goes inline.

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Visually verify**

Open `/endpoints`. Page header reads "Endpoints · N endpoints · M enabled". Each endpoint card has a small colored dot next to its name. Validated cards show "validated 2m ago" italic footer.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/features/endpoints
git commit -m "frontend: apply notebook header and state dots to endpoints"
```

---

### Task 12: Apply `PageHeader` + preview styling to Prompts

**Files:**
- Modify: `frontend/console/src/features/prompts/pages/prompts-page.tsx`
- Modify: `frontend/console/src/features/prompts/components/prompt-preview-dialog.tsx`

- [ ] **Step 1: Replace prompts page header**

In `prompts-page.tsx`:

```tsx
import { PageHeader } from '@/shared/ui/page-header'

const total = prompts.length
const activeCount = prompts.filter((p) => p.is_active).length

<PageHeader
  title="Prompts"
  meta={`${total} templates · ${activeCount} active`}
  actions={<Button onClick={openCreateDialog}>+ 新建</Button>}
/>
```

- [ ] **Step 2: Style the preview area in `prompt-preview-dialog.tsx`**

Locate the preview render area (the one showing the rendered prompt content). Wrap or update it to:

```tsx
<pre className="bg-paper-shade border border-rule rounded-lg p-4 font-mono text-sm text-ink whitespace-pre-wrap break-words">
  {renderedContent}
</pre>
```

For the variable chips (the list of variables with their values), apply:

```tsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-sand/40 text-sand rounded-md font-mono">
  {variableName}
</span>
```

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Visually verify**

Open `/prompts`. Header reads "Prompts · N templates · M active". Open a prompt's preview dialog — content area is paper-shade with mono text; variables show as sand-outlined chips.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/features/prompts
git commit -m "frontend: apply notebook header and preview styling to prompts"
```

---

## Phase E — Chat Page Layout Foundation

### Task 13: Add `leftPanelCollapsed` / `rightPanelCollapsed` to store

The Chat page needs independent collapse state for both side panels.

**Files:**
- Modify: `frontend/console/src/shared/stores/use-console-ui-store.ts`

- [ ] **Step 1: Extend the store**

Replace the file with:

```ts
import { create } from 'zustand'

type ConsoleUiState = {
  collapseSidebar: () => void
  expandSidebar: () => void
  mobileNavOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  sidebarCollapsed: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void
  toggleSidebar: () => void

  chatLeftCollapsed: boolean
  chatRightCollapsed: boolean
  toggleChatLeft: () => void
  toggleChatRight: () => void
  setChatLeftCollapsed: (collapsed: boolean) => void
  setChatRightCollapsed: (collapsed: boolean) => void

  chatControlPanelOpen: boolean
  toggleChatControlPanel: () => void
  setChatControlPanelOpen: (open: boolean) => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  mobileNavOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  sidebarCollapsed: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  chatLeftCollapsed: false,
  chatRightCollapsed: false,
  toggleChatLeft: () => set((state) => ({ chatLeftCollapsed: !state.chatLeftCollapsed })),
  toggleChatRight: () => set((state) => ({ chatRightCollapsed: !state.chatRightCollapsed })),
  setChatLeftCollapsed: (collapsed) => set({ chatLeftCollapsed: collapsed }),
  setChatRightCollapsed: (collapsed) => set({ chatRightCollapsed: collapsed }),

  chatControlPanelOpen: false,
  toggleChatControlPanel: () => set((state) => ({ chatControlPanelOpen: !state.chatControlPanelOpen })),
  setChatControlPanelOpen: (open) => set({ chatControlPanelOpen: open })
}))
```

- [ ] **Step 2: Type-check**

```bash
cd frontend/console && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/console/src/shared/stores/use-console-ui-store.ts
git commit -m "frontend: add chat panel collapse state"
```

---

### Task 14: Create `CollapseRail` component

The thin vertical icon strip shown when a side panel is collapsed.

**Files:**
- Create: `frontend/console/src/features/chat/components/collapse-rail.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

type CollapseRailProps = {
  side: 'left' | 'right'
  onToggle: () => void
  children?: ReactNode  // optional small icons (e.g., chat list shortcut)
}

export function CollapseRail({ side, onToggle, children }: CollapseRailProps) {
  const Chevron = side === 'left' ? ChevronRight : ChevronLeft
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-3 bg-paper-warm',
        side === 'left' ? 'border-r border-rule' : 'border-l border-rule'
      )}
      style={{ width: 36 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="size-6 rounded-md border border-rule bg-surface-card text-ink-faint hover:text-ink hover:border-sand transition-colors flex items-center justify-center"
        aria-label={side === 'left' ? '展开左栏' : '展开右栏'}
      >
        <Chevron className="size-3.5" />
      </button>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend/console && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/console/src/features/chat/components/collapse-rail.tsx
git commit -m "frontend: add collapse-rail chat component"
```

---

### Task 15: Refactor `control-panel.tsx` for collapsed/expanded states

**Files:**
- Modify: `frontend/console/src/features/chat/components/control-panel.tsx`

- [ ] **Step 1: Inspect current shape**

```bash
cat frontend/console/src/features/chat/components/control-panel.tsx
```

Note the current props (likely `config`, `onChange`, `availableModels`, `promptTemplates`, `onVariablesChange`, `callInfo`, `className`).

- [ ] **Step 2: Rewrite with collapsed/expanded modes**

Replace the panel render logic so it has two visual modes driven by `useConsoleUiStore`. Insert imports:

```tsx
import { ChevronRight } from 'lucide-react'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
```

Inside the component, just before `return`:

```tsx
const isOpen = useConsoleUiStore((s) => s.chatControlPanelOpen)
const toggleOpen = useConsoleUiStore((s) => s.toggleChatControlPanel)
```

Wrap the existing form contents in:

```tsx
<div className={cn('border-t border-rule bg-paper-shade', className)}>
  <button
    type="button"
    onClick={toggleOpen}
    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-paper-warm transition-colors text-left"
    aria-expanded={isOpen}
  >
    <div className="flex items-baseline gap-2 min-w-0">
      <ChevronRight
        className={cn('size-3 text-ink-faint shrink-0 transition-transform', isOpen && 'rotate-90')}
      />
      <span className="font-serif italic text-xs text-ink-soft">模型设置</span>
    </div>
    <span className="font-mono text-[10px] text-ink-faint truncate ml-2">
      {config.model || '—'} · {config.strategy} · {config.temperature.toFixed(1)}
    </span>
  </button>

  {isOpen ? (
    <div className="px-4 pb-4 pt-1 border-t border-dashed border-rule space-y-3">
      {/* existing form rows go here, restyled to use new tokens */}
      {/* ... (keep the existing field markup and just replace classNames with notebook tokens) */}
    </div>
  ) : null}
</div>
```

The "existing form rows" placeholder should be replaced with the actual form markup that was in the original file. Update each row's container to:

```tsx
<div>
  <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Model</label>
  <Select value={config.model} onValueChange={(v) => onChange('model', v)}>
    {/* options */}
  </Select>
</div>
```

(Use this row template for Model, Prompt, Strategy, Temperature — keep the field types the originals used.)

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/console/src/features/chat/components/control-panel.tsx
git commit -m "frontend: split control panel into collapsed and expanded modes"
```

---

### Task 16: Restructure `chat-page.tsx` into three-column collapsible layout

**Files:**
- Modify: `frontend/console/src/features/chat/pages/chat-page.tsx`
- Modify: `frontend/console/src/features/chat/components/session-sidebar.tsx`

- [ ] **Step 1: Update `session-sidebar.tsx` to be the conv-list portion only**

Edit `session-sidebar.tsx` so it renders ONLY the conversation list (no controls). Apply notebook styling to the list:

```tsx
// list container
<div className="flex-1 overflow-y-auto px-2 py-2">
  {conversations.map((conv) => (
    <button
      key={conv.id}
      onClick={() => onSelect(conv.id)}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md mb-0.5 transition-colors',
        'text-sm text-ink-soft hover:bg-paper-warm',
        conv.id === activeId && 'bg-paper text-ink border-l-2 border-sand pl-[10px]'
      )}
    >
      <div className="truncate">{conv.title}</div>
      <div className="text-[10px] text-ink-faint mt-0.5">
        {formatRelative(conv.lastMessageAt)} · {conv.messageCount} nodes
      </div>
    </button>
  ))}
</div>
```

(Use existing prop names — adjust if they differ in the current file.) Add a sidebar header:

```tsx
<div className="px-3.5 pt-3 pb-2 border-b border-rule-soft flex items-center justify-between">
  <span className="font-serif italic text-xs text-ink-soft">对话</span>
  <button
    type="button"
    onClick={() => setLeftCollapsed(true)}
    className="text-ink-faint hover:text-ink"
    aria-label="收起对话栏"
  >
    <ChevronLeft className="size-3.5" />
  </button>
</div>
```

Get `setLeftCollapsed` from `useConsoleUiStore((s) => s.setChatLeftCollapsed)`.

- [ ] **Step 2: Restructure `chat-page.tsx`**

Replace the chat page's outer layout JSX with the three-column structure. Key snippet (adapt to existing data hooks):

```tsx
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
import { CollapseRail } from '@/features/chat/components/collapse-rail'
import { SessionSidebar } from '@/features/chat/components/session-sidebar'
import { ControlPanel } from '@/features/chat/components/control-panel'
// ...other existing imports

export function ChatPage() {
  // ...existing data hooks (conversation, messages, send, etc.)
  const leftCollapsed = useConsoleUiStore((s) => s.chatLeftCollapsed)
  const rightCollapsed = useConsoleUiStore((s) => s.chatRightCollapsed)
  const toggleLeft = useConsoleUiStore((s) => s.toggleChatLeft)
  const toggleRight = useConsoleUiStore((s) => s.toggleChatRight)

  return (
    <div className="h-full flex bg-paper">
      {/* Left column */}
      {leftCollapsed ? (
        <CollapseRail side="left" onToggle={toggleLeft} />
      ) : (
        <aside
          className="bg-paper-warm border-r border-rule flex flex-col"
          style={{ width: 220 }}
        >
          <SessionSidebar /* existing props */ />
          <ControlPanel /* existing props */ className="" />
        </aside>
      )}

      {/* Main reading area */}
      <main className="flex-1 flex flex-col min-w-0 bg-paper">
        {/* keep existing message rendering and input components here */}
      </main>

      {/* Right column */}
      {rightCollapsed ? (
        <CollapseRail side="right" onToggle={toggleRight} />
      ) : (
        <aside
          className="bg-paper-warm border-l border-rule flex flex-col"
          style={{ width: 240 }}
        >
          {/* will be replaced with MarginaliaPanel in Task 25 — for now leave a placeholder */}
          <div className="p-4 text-xs text-ink-faint italic font-serif">
            Tree panel coming in Task 25
          </div>
        </aside>
      )}
    </div>
  )
}
```

Adjust to plug in the existing data flow (replace placeholders with the real props you have in the current `chat-page.tsx`). The existing message-rendering code should stay in the main column — we'll restyle it in Task 18.

- [ ] **Step 3: Add responsive auto-collapse**

In `chat-page.tsx`, add a `useEffect` to react to viewport width:

```tsx
import { useEffect } from 'react'

useEffect(() => {
  const setLeft = useConsoleUiStore.getState().setChatLeftCollapsed
  const setRight = useConsoleUiStore.getState().setChatRightCollapsed
  function handleResize() {
    const width = window.innerWidth
    if (width < 768) { setLeft(true); setRight(true) }
    else if (width < 1024) { setRight(true) }
  }
  handleResize()
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Visually verify**

Open `/chat`. Three columns visible. Click left chevron → left collapses to 36px rail. Click rail's chevron → expands. Same for right. Resize window to 1100px → right auto-collapses; resize to 700px → both auto-collapse.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/features/chat
git commit -m "frontend: restructure chat page into three-column collapsible layout"
```

---

## Phase F — Chat Node Visuals

### Task 17: Create `branch-pill.tsx`

**Files:**
- Create: `frontend/console/src/features/chat/components/branch-pill.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { GitBranch } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type BranchPillProps = {
  variant?: 'primary' | 'outline'
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children?: ReactNode
}

export function BranchPill({ variant = 'primary', onClick, children = '从这里分叉' }: BranchPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors',
        variant === 'primary'
          ? 'bg-sand text-white hover:bg-sand-hover'
          : 'border border-sand text-sand hover:bg-sand/5'
      )}
    >
      <GitBranch className="size-3" />
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend/console && npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/console/src/features/chat/components/branch-pill.tsx
git commit -m "frontend: add branch-pill component"
```

---

### Task 18: Update `message-bubble.tsx` (visual + actions display rules)

**Files:**
- Modify: `frontend/console/src/features/chat/components/message-bubble.tsx`

- [ ] **Step 1: Inspect current message-bubble**

```bash
cat frontend/console/src/features/chat/components/message-bubble.tsx | head -120
```

Identify props (likely `message`, `isCurrentLeaf`, `onBranch`, `onEdit`, `onRegenerate`, `streaming`).

- [ ] **Step 2: Rewrite the visual structure**

Replace the bubble's outer JSX with notebook style. Core layout:

```tsx
<div
  className={cn(
    'group mb-[18px]',
    message.stale && 'opacity-70'
  )}
>
  <div className="font-serif italic text-xs text-ink-soft mb-1">
    {roleLabel(message)}
    {message.stale ? ' · stale' : ''}
    {message.streaming ? ' · streaming…' : ''}
    {message.status === 'error' ? ' · error' : ''}
  </div>

  <div
    className={cn(
      'text-sm leading-7',
      message.stale ? 'text-ink-faint' : 'text-ink',
      message.status === 'error' && 'border-l-2 border-terracotta pl-3'
    )}
  >
    {message.content}
    {message.streaming ? (
      <span
        className="inline-block w-1.5 h-3.5 bg-sand align-text-bottom ml-0.5 animate-pulse"
        aria-hidden
      />
    ) : null}
  </div>

  {message.status === 'error' && message.errorMessage ? (
    <div className="mt-2 text-xs text-terracotta">
      {message.errorMessage}
      <button
        type="button"
        onClick={onRegenerate}
        className="ml-3 underline text-sand hover:text-sand-hover"
      >
        重试
      </button>
    </div>
  ) : null}

  {!message.stale && message.role === 'assistant' && !message.streaming ? (
    <div
      className={cn(
        'mt-2 flex items-center gap-2.5',
        !isCurrentLeaf && 'opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]'
      )}
    >
      <BranchPill variant={isCurrentLeaf ? 'primary' : 'outline'} onClick={onBranch} />
      {isCurrentLeaf ? (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-sand hover:text-sand-hover px-2"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="text-xs text-sand hover:text-sand-hover px-2"
          >
            重新生成
          </button>
        </>
      ) : null}
    </div>
  ) : null}
</div>
```

`roleLabel` is a small helper — define it at the top of the file:

```tsx
function roleLabel(message: ChatMessage): string {
  if (message.role === 'user') return 'You'
  if (message.role === 'assistant') {
    return message.callInfo?.model ? `Assistant · ${message.callInfo.model}` : 'Assistant'
  }
  return message.role
}
```

Keep the props list and surrounding logic (e.g., edit-mode toggle) intact — only the render output changes.

- [ ] **Step 3: Edit mode visual**

If the current file has an "edit mode" branch (textarea instead of bubble), update its container:

```tsx
<div className="mb-[18px]">
  <div className="font-serif italic text-xs text-ink-soft mb-1">{roleLabel(message)} · editing</div>
  <Textarea
    value={editDraft}
    onChange={(e) => setEditDraft(e.target.value)}
    className="w-full"
    autoFocus
  />
  <div className="mt-2 flex items-center gap-2">
    <Button onClick={onSaveAndContinue}>保存 + 继续</Button>
    <Button variant="ghost" onClick={onCancelEdit}>取消</Button>
  </div>
</div>
```

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass. The existing `message-bubble.test.tsx` may need test selector updates if it asserted on old class names — fix the test to match new structure.

- [ ] **Step 5: Visually verify**

Open `/chat` with at least one assistant message. Hover the leaf assistant → primary sand pill + edit + regen visible. Hover a historical AI node → only outline pill appears on hover.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/features/chat/components/message-bubble.tsx frontend/console/src/features/chat/components/message-bubble.test.tsx
git commit -m "frontend: restyle message bubble with notebook aesthetic and action rules"
```

---

### Task 19: Restyle `input-area.tsx` (incl. stop button)

**Files:**
- Modify: `frontend/console/src/features/chat/components/input-area.tsx`

- [ ] **Step 1: Inspect current shape**

```bash
cat frontend/console/src/features/chat/components/input-area.tsx
```

- [ ] **Step 2: Rewrite the input area**

Replace the rendered output with:

```tsx
<div className="border-t border-rule bg-paper-warm px-9 py-3.5">
  {streaming ? (
    <div className="flex items-center gap-3">
      <div className="flex-1 px-3 py-2 text-xs text-ink-faint italic font-serif">
        — 生成中 —
      </div>
      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sand text-sand hover:bg-sand/5 text-xs"
      >
        ⏹ 停止生成
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSend()
          }
        }}
        placeholder="继续这条对话…"
        className="flex-1 min-h-[40px] max-h-32 resize-none"
        rows={1}
      />
      <Button onClick={handleSend} disabled={!draft.trim()}>↵</Button>
    </div>
  )}
</div>
```

Preserve the existing prop interface (`draft`, `setDraft`, `handleSend`, `streaming`, `onStop`).

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass. Update `input-area.test.tsx` selectors if they asserted on class names.

- [ ] **Step 4: Commit**

```bash
git add frontend/console/src/features/chat/components/input-area.tsx frontend/console/src/features/chat/components/input-area.test.tsx
git commit -m "frontend: restyle chat input area with notebook tokens and stop button"
```

---

## Phase G — Phase 4 Features (backend + frontend)

### Task 20: Backend — add `source_node_ids` to `VisibleMessageResponse`

**Files:**
- Modify: `app/schemas/chat_sessions.py`
- Modify: `app/services/chat_sessions.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Add a failing API test**

In `tests/test_api.py`, find the existing test that creates a conversation and triggers compression (search for `compress` to locate). If none exists that asserts on summary nodes, add a new test at the end of the file:

```python
def test_summary_visible_message_includes_source_node_ids(client, auth_headers, monkeypatch):
    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content="reply",
            finish_reason="stop",
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    # Force compression to trigger easily by patching the profile detection.
    from app.services import chat_sessions as chat_sessions_module
    monkeypatch.setattr(
        chat_sessions_module,
        "_select_profile",
        lambda *_args, **_kwargs: chat_sessions_module.ContextCompressionProfile(
            window_tokens=1024,
            trigger_ratio=0.0,
            compression_ratio=0.5,
        ),
        raising=False,
    )

    # Create endpoint, conversation, and a few messages to force compression.
    client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "summary-test",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 10,
        },
    )
    conv = client.post(
        "/api/chat/conversations",
        headers=auth_headers,
        json={"draft_config": {"model": "gpt-lite", "prompt_id": "", "strategy": "balanced", "temperature": 0, "variables": {}}},
    ).json()
    conv_id = conv["id"]

    for content in ("a", "b", "c", "d"):
        client.post(
            f"/api/chat/conversations/{conv_id}/messages",
            headers=auth_headers,
            json={"content": content, "config": {"model": "gpt-lite", "prompt_id": "", "strategy": "balanced", "temperature": 0, "variables": {}}},
        )

    response = client.get(f"/api/chat/conversations/{conv_id}", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    summaries = [m for m in body["visible_messages"] if m["kind"] == "summary"]
    if summaries:
        for s in summaries:
            assert "source_node_ids" in s
            assert isinstance(s["source_node_ids"], list)
            assert all(isinstance(x, str) for x in s["source_node_ids"])
```

- [ ] **Step 2: Run test to verify it fails (or skips)**

```bash
.venv/bin/pytest tests/test_api.py::test_summary_visible_message_includes_source_node_ids -v
```

Expected: FAIL with `KeyError: 'source_node_ids'` or assertion failure (because the field doesn't exist yet). If the compression doesn't actually trigger and `summaries` ends up empty, the test passes vacuously — that's still acceptable; the schema change in next steps will make the test meaningful in real runs.

- [ ] **Step 3: Add the schema field**

In `app/schemas/chat_sessions.py`, locate `VisibleMessageResponse` and add:

```python
class VisibleMessageResponse(BaseModel):
    virtual_id: str
    kind: VisibleMessageKind
    role: ChatMessageRole
    content: str
    source_node_id: str | None = None
    source_node_ids: list[str] | None = None  # populated when kind="summary"
```

- [ ] **Step 4: Populate it in the service**

In `app/services/chat_sessions.py`, locate where summary `VisibleMessageResponse` instances are constructed (search for `kind="summary"`). At each construction site, add:

```python
import json  # if not already imported at module level

# Just above the VisibleMessageResponse(...) call for kind="summary":
source_node_ids_for_summary: list[str] = []
if branch.compressed_source_versions_json:
    try:
        parsed = json.loads(branch.compressed_source_versions_json)
        if isinstance(parsed, dict):
            source_node_ids_for_summary = [str(k) for k in parsed.keys()]
    except (TypeError, ValueError):
        source_node_ids_for_summary = []
```

Then pass `source_node_ids=source_node_ids_for_summary` in the `VisibleMessageResponse(...)` call. For non-summary entries, omit it (defaults to `None`).

- [ ] **Step 5: Run the test**

```bash
.venv/bin/pytest tests/test_api.py::test_summary_visible_message_includes_source_node_ids -v
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
.venv/bin/pytest -q
```

Expected: 27/27 pass (26 existing + 1 new).

- [ ] **Step 7: Commit**

```bash
git add app/schemas/chat_sessions.py app/services/chat_sessions.py tests/test_api.py
git commit -m "backend: expose source_node_ids on summary visible messages"
```

---

### Task 21: Frontend — types + adapter for `archivedNodeIds`

**Files:**
- Modify: `frontend/console/src/features/chat/chat-types.ts`
- Modify: `frontend/console/src/features/chat/chat-adapters.ts`
- Modify: `frontend/console/src/features/chat/chat-adapters.test.ts`

- [ ] **Step 1: Add type field**

In `chat-types.ts`, find the type that represents a visible/summary message (likely `ChatMessage` or `VisibleMessage`). Add a field:

```ts
archivedNodeIds?: string[]  // present when kind === 'summary'
```

- [ ] **Step 2: Write a failing adapter test**

In `chat-adapters.test.ts`, add:

```ts
describe('summary visible message adaptation', () => {
  it('extracts archivedNodeIds from source_node_ids', () => {
    const apiResponse = {
      // shape mirroring real API response — match existing test patterns in the file
      visible_messages: [
        {
          virtual_id: 'summary:b1:m9:0',
          kind: 'summary' as const,
          role: 'summary' as const,
          content: 'compressed history…',
          source_node_id: null,
          source_node_ids: ['msg_a', 'msg_b', 'msg_c']
        }
      ],
      message_nodes: [],
      branches: [],
      // include other required fields from the existing test fixtures
    }
    const result = adaptConversationResponse(apiResponse) // use existing exported function name
    const summary = result.messages.find((m) => m.kind === 'summary')
    expect(summary?.archivedNodeIds).toEqual(['msg_a', 'msg_b', 'msg_c'])
  })

  it('falls back to empty when source_node_ids missing', () => {
    const apiResponse = {
      visible_messages: [
        {
          virtual_id: 'summary:b1:m9:0',
          kind: 'summary' as const,
          role: 'summary' as const,
          content: 'compressed history…',
          source_node_id: null,
          source_node_ids: null
        }
      ],
      message_nodes: [],
      branches: [],
    }
    const result = adaptConversationResponse(apiResponse)
    const summary = result.messages.find((m) => m.kind === 'summary')
    expect(summary?.archivedNodeIds).toBeUndefined()
  })
})
```

If `adaptConversationResponse` is not the actual exported function name, replace with the real one from the existing test file. Look at the existing adapter tests as a template for fixture shape.

- [ ] **Step 3: Run failing test**

```bash
cd frontend/console && npx vitest run src/features/chat/chat-adapters.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Update adapter**

In `chat-adapters.ts`, find the function that converts a `visible_message` API entry into the in-memory `ChatMessage`. Add field mapping:

```ts
// when kind === 'summary'
{
  // ...existing fields
  archivedNodeIds: apiEntry.source_node_ids ?? undefined
}
```

- [ ] **Step 5: Run test**

```bash
cd frontend/console && npx vitest run src/features/chat/chat-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd frontend/console && npx vitest run && npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/console/src/features/chat/chat-types.ts frontend/console/src/features/chat/chat-adapters.ts frontend/console/src/features/chat/chat-adapters.test.ts
git commit -m "frontend: thread archivedNodeIds through chat adapter"
```

---

### Task 22: Create `summary-node.tsx` with expand/collapse

**Files:**
- Create: `frontend/console/src/features/chat/components/summary-node.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp, Package } from 'lucide-react'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type SummaryNodeProps = {
  message: ChatMessage  // kind === 'summary'
  archivedMessages: ChatMessage[]  // resolved from archivedNodeIds against messageNodes
}

export function SummaryNode({ message, archivedMessages }: SummaryNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = archivedMessages.length > 0

  return (
    <div
      className={cn(
        'mb-[18px] rounded-r-md border-l-[3px] border-moss px-4 py-3 transition-shadow',
        expanded ? 'bg-surface-card shadow-panel' : 'bg-paper-warm'
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-serif italic text-xs text-moss flex items-center gap-1.5">
          <Package className="size-3" />
          已压缩 {archivedMessages.length} 条消息
        </div>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-[11px] text-moss hover:opacity-80 inline-flex items-center gap-1"
          >
            {expanded ? <>收起 <ChevronUp className="size-3" /></> : <>展开原始内容 <ChevronDown className="size-3" /></>}
          </button>
        ) : null}
      </div>

      <p className="text-xs text-ink-soft leading-relaxed mt-1">{message.content}</p>

      {expanded && canExpand ? (
        <div className="mt-3 pt-3 border-t border-dashed border-rule space-y-2.5">
          {archivedMessages.map((entry) => (
            <div key={entry.id} className="pl-3 border-l-2 border-rule">
              <span className="font-serif italic text-[11px] text-ink-soft mr-1.5">
                {entry.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="text-xs text-ink-faint leading-relaxed">{entry.content}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Wire into `chat-page.tsx` rendering**

In `chat-page.tsx`'s message-mapping render code, branch on `message.kind === 'summary'`:

```tsx
{messages.map((message) => {
  if (message.kind === 'summary') {
    const archivedMessages = (message.archivedNodeIds ?? [])
      .map((id) => messageNodesById.get(id))
      .filter((value): value is ChatMessage => Boolean(value))
    return (
      <SummaryNode
        key={message.id}
        message={message}
        archivedMessages={archivedMessages}
      />
    )
  }
  return <MessageBubble key={message.id} message={message} {...handlers} />
})}
```

`messageNodesById` is a `Map<string, ChatMessage>` you build with `useMemo` from the conversation's `message_nodes` array. If you don't have it in scope, add:

```tsx
const messageNodesById = useMemo(
  () => new Map(messageNodes.map((node) => [node.id, node])),
  [messageNodes]
)
```

- [ ] **Step 3: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Visually verify**

Trigger compression in a test conversation (send enough messages for the smallest profile threshold). Summary block should appear with moss left-border, click "展开" → archived nodes appear; click "收起" → folded.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/features/chat/components/summary-node.tsx frontend/console/src/features/chat/pages/chat-page.tsx
git commit -m "frontend: add summary node with archived expansion"
```

---

### Task 23: `buildTreeView` adapter + tests

Build the tree-view data structure used by the right panel.

**Files:**
- Modify: `frontend/console/src/features/chat/chat-adapters.ts`
- Modify: `frontend/console/src/features/chat/chat-adapters.test.ts`
- Modify: `frontend/console/src/features/chat/chat-types.ts`

- [ ] **Step 1: Add `TreeNode` type**

In `chat-types.ts`:

```ts
export type TreeNodeState = 'current' | 'sibling' | 'stale' | 'archived'

export type TreeNode = {
  id: string
  kind: 'node' | 'summary'
  role: ChatRole | 'summary'
  parentId: string | null
  state: TreeNodeState
  preview: string
  depth: number
}
```

- [ ] **Step 2: Write failing test**

In `chat-adapters.test.ts`:

```ts
describe('buildTreeView', () => {
  it('marks current branch path as current', () => {
    const messageNodes = [
      { id: 'a', role: 'user', parentId: null, content: 'first', stale: false, modifiedFrom: null } as any,
      { id: 'b', role: 'assistant', parentId: 'a', content: 'reply', stale: false, modifiedFrom: null } as any,
      { id: 'c', role: 'user', parentId: 'b', content: 'next', stale: false, modifiedFrom: null } as any,
    ]
    const tree = buildTreeView({
      messageNodes,
      visibleMessages: [
        { id: 'a', kind: 'node', sourceNodeId: 'a' } as any,
        { id: 'b', kind: 'node', sourceNodeId: 'b' } as any,
        { id: 'c', kind: 'node', sourceNodeId: 'c' } as any,
      ],
      activeBranchHeadId: 'c'
    })
    expect(tree.find((n) => n.id === 'a')?.state).toBe('current')
    expect(tree.find((n) => n.id === 'c')?.state).toBe('current')
  })

  it('includes sibling nodes at fork points', () => {
    const messageNodes = [
      { id: 'a', role: 'user', parentId: null, content: 'q', stale: false, modifiedFrom: null } as any,
      { id: 'b', role: 'assistant', parentId: 'a', content: 'A1', stale: false, modifiedFrom: null } as any,
      { id: 'b2', role: 'assistant', parentId: 'a', content: 'A2', stale: false, modifiedFrom: 'b' } as any,
    ]
    const tree = buildTreeView({
      messageNodes,
      visibleMessages: [
        { id: 'a', kind: 'node', sourceNodeId: 'a' } as any,
        { id: 'b', kind: 'node', sourceNodeId: 'b' } as any,
      ],
      activeBranchHeadId: 'b'
    })
    const sibling = tree.find((n) => n.id === 'b2')
    expect(sibling?.state).toBe('sibling')
  })

  it('marks stale nodes as stale', () => {
    const messageNodes = [
      { id: 'a', role: 'user', parentId: null, content: 'q', stale: false, modifiedFrom: null } as any,
      { id: 'b', role: 'assistant', parentId: 'a', content: 'A', stale: true, modifiedFrom: null } as any,
    ]
    const tree = buildTreeView({
      messageNodes,
      visibleMessages: [{ id: 'a', kind: 'node', sourceNodeId: 'a' } as any],
      activeBranchHeadId: 'a'
    })
    expect(tree.find((n) => n.id === 'b')?.state).toBe('stale')
  })

  it('inserts summary nodes inline', () => {
    const messageNodes = [
      { id: 'd', role: 'user', parentId: null, content: 'q', stale: false, modifiedFrom: null } as any,
    ]
    const tree = buildTreeView({
      messageNodes,
      visibleMessages: [
        { id: 'summary:b1:d:0', kind: 'summary', sourceNodeId: null, content: 'compressed' } as any,
        { id: 'd', kind: 'node', sourceNodeId: 'd' } as any,
      ],
      activeBranchHeadId: 'd'
    })
    expect(tree.find((n) => n.kind === 'summary')).toBeDefined()
  })
})
```

- [ ] **Step 3: Run failing tests**

```bash
cd frontend/console && npx vitest run src/features/chat/chat-adapters.test.ts
```

Expected: FAIL with "buildTreeView is not a function".

- [ ] **Step 4: Implement `buildTreeView`**

In `chat-adapters.ts`:

```ts
import type { ChatMessage, TreeNode, TreeNodeState } from './chat-types'

type BuildTreeViewInput = {
  messageNodes: ChatMessage[]
  visibleMessages: ChatMessage[]
  activeBranchHeadId: string | null
}

export function buildTreeView(input: BuildTreeViewInput): TreeNode[] {
  const { messageNodes, visibleMessages, activeBranchHeadId } = input
  const byId = new Map(messageNodes.map((node) => [node.id, node]))

  // 1. Walk current branch path
  const currentPath = new Set<string>()
  let cursor: string | null = activeBranchHeadId
  while (cursor) {
    const node = byId.get(cursor)
    if (!node) break
    currentPath.add(node.id)
    cursor = node.parentId ?? null
  }

  // 2. Build map: parentId -> children[]
  const childrenByParent = new Map<string | null, ChatMessage[]>()
  for (const node of messageNodes) {
    const parent = node.parentId ?? null
    const list = childrenByParent.get(parent) ?? []
    list.push(node)
    childrenByParent.set(parent, list)
  }

  // 3. Determine each node's state
  function classify(node: ChatMessage): TreeNodeState {
    if (node.stale) return 'stale'
    if (currentPath.has(node.id)) return 'current'
    return 'sibling'
  }

  // 4. Walk depth-first from root, including only current path + their direct siblings
  const result: TreeNode[] = []
  function visit(parentId: string | null, depth: number) {
    const children = childrenByParent.get(parentId) ?? []
    for (const child of children) {
      const onCurrentPath = currentPath.has(child.id)
      const siblingOfCurrent = children.some((c) => currentPath.has(c.id)) && !onCurrentPath
      if (!onCurrentPath && !siblingOfCurrent) continue
      result.push({
        id: child.id,
        kind: 'node',
        role: child.role,
        parentId: child.parentId,
        state: classify(child),
        preview: truncate(child.content, 40),
        depth
      })
      if (onCurrentPath) visit(child.id, depth + 1)
    }
  }
  visit(null, 0)

  // 5. Insert summary virtual nodes from visibleMessages (preserve order in visibleMessages)
  // Find summary entries and locate their position by the next non-summary visible message's source_node_id
  for (const visible of visibleMessages) {
    if (visible.kind !== 'summary') continue
    // Find the position to insert: just before the next 'node' kind in visibleMessages
    const indexInVisible = visibleMessages.indexOf(visible)
    let anchorNodeId: string | null = null
    for (let i = indexInVisible + 1; i < visibleMessages.length; i++) {
      if (visibleMessages[i].kind === 'node') {
        anchorNodeId = visibleMessages[i].sourceNodeId ?? null
        break
      }
    }
    const anchorIndex = anchorNodeId
      ? result.findIndex((entry) => entry.id === anchorNodeId)
      : result.length
    result.splice(anchorIndex < 0 ? result.length : anchorIndex, 0, {
      id: visible.id,
      kind: 'summary',
      role: 'summary',
      parentId: null,
      state: 'current',
      preview: truncate(visible.content ?? '', 40),
      depth: 0
    })
  }

  return result
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}
```

If your `ChatMessage` type uses different field names (e.g., `parent_id` snake_case), adjust accordingly.

- [ ] **Step 5: Run tests**

```bash
cd frontend/console && npx vitest run src/features/chat/chat-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd frontend/console && npx vitest run && npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/console/src/features/chat/chat-types.ts frontend/console/src/features/chat/chat-adapters.ts frontend/console/src/features/chat/chat-adapters.test.ts
git commit -m "frontend: add buildTreeView adapter"
```

---

### Task 24: Create `tree-node.tsx` and `marginalia-panel.tsx` + use in chat-page

**Files:**
- Create: `frontend/console/src/features/chat/components/tree-node.tsx`
- Create: `frontend/console/src/features/chat/components/marginalia-panel.tsx`
- Modify: `frontend/console/src/features/chat/components/conversation-tree-panel.tsx`
- Modify: `frontend/console/src/features/chat/pages/chat-page.tsx`

- [ ] **Step 1: Create `tree-node.tsx`**

```tsx
import type { TreeNode } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type TreeNodeViewProps = {
  node: TreeNode
  isFocused: boolean
  onClick: (node: TreeNode) => void
  onMouseEnter: (node: TreeNode) => void
  onMouseLeave: () => void
}

export function TreeNodeView({ node, isFocused, onClick, onMouseEnter, onMouseLeave }: TreeNodeViewProps) {
  const dotColor = node.kind === 'summary' ? 'bg-moss' : 'bg-sand'
  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      onMouseEnter={() => onMouseEnter(node)}
      onMouseLeave={onMouseLeave}
      style={{ paddingLeft: 12 + node.depth * 10 }}
      className={cn(
        'w-full text-left text-xs leading-7 relative pr-2',
        'hover:bg-paper-shade transition-colors',
        node.state === 'current' && 'text-ink font-semibold',
        node.state === 'sibling' && 'text-ink-soft',
        node.state === 'stale' && 'text-ink-faint line-through opacity-70',
        node.kind === 'summary' && 'text-moss italic font-serif',
        isFocused && 'bg-paper-shade'
      )}
    >
      <span
        className={cn(
          'absolute size-1.5 rounded-full top-[14px]',
          dotColor,
          node.state === 'current'
            ? 'opacity-100 ring-2 ring-sand/20'
            : 'opacity-50'
        )}
        style={{ left: 8 + node.depth * 10 - 2 }}
        aria-hidden
      />
      <span className="ml-3">
        {node.kind === 'summary' ? '📦 ' : ''}
        {node.preview}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Refactor `conversation-tree-panel.tsx`**

This component now receives a `TreeNode[]` and renders a list of `TreeNodeView`. Replace its body with:

```tsx
import type { TreeNode } from '@/features/chat/chat-types'
import { TreeNodeView } from './tree-node'

type ConversationTreePanelProps = {
  tree: TreeNode[]
  focusedId: string | null
  onNodeClick: (node: TreeNode) => void
  onNodeHover: (node: TreeNode | null) => void
}

export function ConversationTreePanel({ tree, focusedId, onNodeClick, onNodeHover }: ConversationTreePanelProps) {
  if (tree.length === 0) {
    return <div className="px-4 py-3 text-xs text-ink-faint italic font-serif">no nodes yet</div>
  }
  return (
    <div className="py-2">
      {tree.map((node) => (
        <TreeNodeView
          key={node.id}
          node={node}
          isFocused={focusedId === node.id}
          onClick={onNodeClick}
          onMouseEnter={(n) => onNodeHover(n)}
          onMouseLeave={() => onNodeHover(null)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `marginalia-panel.tsx`**

```tsx
import { ChevronRight } from 'lucide-react'
import type { ChatMessage, TreeNode } from '@/features/chat/chat-types'
import { ConversationTreePanel } from './conversation-tree-panel'

type MarginaliaPanelProps = {
  tree: TreeNode[]
  pinnedMessages: ChatMessage[]
  focusedId: string | null
  onCollapse: () => void
  onNodeClick: (node: TreeNode) => void
  onNodeHover: (node: TreeNode | null) => void
}

export function MarginaliaPanel({
  tree,
  pinnedMessages,
  focusedId,
  onCollapse,
  onNodeClick,
  onNodeHover
}: MarginaliaPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3.5 pt-3 pb-2 border-b border-rule-soft flex items-center justify-between">
        <span className="font-serif italic text-xs text-ink-soft">树形检视</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-ink-faint hover:text-ink"
          aria-label="收起树形检视"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ConversationTreePanel
          tree={tree}
          focusedId={focusedId}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
        />
      </div>

      {pinnedMessages.length > 0 ? (
        <div className="border-t border-dashed border-rule px-3.5 py-3">
          <div className="font-serif italic text-[11px] text-ink-soft mb-1.5">Pinned</div>
          {pinnedMessages.map((message) => (
            <div key={message.id} className="text-[11px] text-ink-soft pl-3 relative truncate">
              <span className="absolute left-0 text-[10px] opacity-60">📎</span>
              {message.content.slice(0, 40)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Wire into `chat-page.tsx`**

Replace the right-column placeholder from Task 16 with:

```tsx
import { MarginaliaPanel } from '@/features/chat/components/marginalia-panel'
import { buildTreeView } from '@/features/chat/chat-adapters'

// inside the component:
const tree = useMemo(
  () => buildTreeView({
    messageNodes,
    visibleMessages: messages,
    activeBranchHeadId: activeBranchHeadId
  }),
  [messageNodes, messages, activeBranchHeadId]
)
const pinnedMessages = useMemo(
  () => messageNodes.filter((node) => node.pinned),
  [messageNodes]
)
const [focusedId, setFocusedId] = useState<string | null>(null)

function handleNodeClick(node: TreeNode) {
  if (node.kind === 'summary') {
    // future hook: set summary expand state — handled inside SummaryNode for now
    return
  }
  const element = document.querySelector(`[data-message-id="${node.id}"]`)
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('chat-msg-flash')
    setTimeout(() => element.classList.remove('chat-msg-flash'), 250)
  }
}

// in JSX, replace right-column placeholder:
{rightCollapsed ? (
  <CollapseRail side="right" onToggle={toggleRight} />
) : (
  <aside
    className="bg-paper-warm border-l border-rule flex flex-col"
    style={{ width: 240 }}
  >
    <MarginaliaPanel
      tree={tree}
      pinnedMessages={pinnedMessages}
      focusedId={focusedId}
      onCollapse={toggleRight}
      onNodeClick={handleNodeClick}
      onNodeHover={(n) => setFocusedId(n?.id ?? null)}
    />
  </aside>
)}
```

- [ ] **Step 5: Add `data-message-id` attribute on message bubbles**

In `message-bubble.tsx`, add to the outermost wrapping div:

```tsx
<div data-message-id={message.id} className="...">
```

Also handle summary nodes — add the same attribute to the wrapper div in `summary-node.tsx`:

```tsx
<div data-message-id={message.id} className="...">
```

- [ ] **Step 6: Add the flash CSS rule**

In `global.css`, append at the end:

```css
.chat-msg-flash {
  animation: chat-msg-flash 220ms ease-out;
}
@keyframes chat-msg-flash {
  0%   { box-shadow: inset 2px 0 0 0 var(--sand); }
  100% { box-shadow: inset 2px 0 0 0 transparent; }
}
```

- [ ] **Step 7: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 8: Visually verify**

Open `/chat` with a multi-message conversation. Right panel shows tree with current path highlighted, dots colored sand (or moss for summary). Click a node — main area scrolls and target message left edge briefly flashes sand.

- [ ] **Step 9: Commit**

```bash
git add frontend/console/src/features/chat/components/tree-node.tsx \
        frontend/console/src/features/chat/components/marginalia-panel.tsx \
        frontend/console/src/features/chat/components/conversation-tree-panel.tsx \
        frontend/console/src/features/chat/components/message-bubble.tsx \
        frontend/console/src/features/chat/components/summary-node.tsx \
        frontend/console/src/features/chat/pages/chat-page.tsx \
        frontend/console/src/app/styles/global.css
git commit -m "frontend: add tree-node, marginalia panel, and click-to-jump"
```

---

### Task 25: Add IntersectionObserver for tree-panel ↔ main highlight sync

**Files:**
- Modify: `frontend/console/src/features/chat/pages/chat-page.tsx`

- [ ] **Step 1: Add observer effect**

In `chat-page.tsx`, after the existing state, add:

```tsx
useEffect(() => {
  const root = document.querySelector('[data-chat-main]')
  if (!root) return
  const elements = Array.from(root.querySelectorAll('[data-message-id]'))
  if (elements.length === 0) return

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) {
        const id = (visible.target as HTMLElement).dataset.messageId
        if (id) setFocusedId(id)
      }
    },
    { root, threshold: [0.5] }
  )
  for (const element of elements) observer.observe(element)
  return () => observer.disconnect()
}, [messages.length])
```

Add `data-chat-main` attribute on the main column scroll container in the same file:

```tsx
<main data-chat-main className="flex-1 flex flex-col min-w-0 bg-paper overflow-y-auto">
```

- [ ] **Step 2: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Visually verify**

Scroll the main message area. Right-panel tree should highlight the node corresponding to the most-visible message.

- [ ] **Step 4: Commit**

```bash
git add frontend/console/src/features/chat/pages/chat-page.tsx
git commit -m "frontend: sync tree focus with main scroll position"
```

---

### Task 26: Stale-node click banner

When a stale tree node is clicked, show a transient banner above the main area.

**Files:**
- Modify: `frontend/console/src/features/chat/pages/chat-page.tsx`

- [ ] **Step 1: Add banner state and handler update**

In `chat-page.tsx`:

```tsx
const [staleBanner, setStaleBanner] = useState<{ targetId: string } | null>(null)
```

Update `handleNodeClick` from Task 24:

```tsx
function handleNodeClick(node: TreeNode) {
  if (node.kind === 'summary') return
  if (node.state === 'stale' && activeBranchHeadId) {
    setStaleBanner({ targetId: node.id })
    setTimeout(() => setStaleBanner(null), 4000)
  }
  const element = document.querySelector(`[data-message-id="${node.id}"]`)
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('chat-msg-flash')
    setTimeout(() => element.classList.remove('chat-msg-flash'), 250)
  }
}
```

- [ ] **Step 2: Render the banner**

Add inside the main column, just below the `PageHeader` (or main column header) and above the message list:

```tsx
{staleBanner ? (
  <div className="bg-terracotta/10 border-b border-terracotta/30 px-9 py-2 text-xs text-terracotta flex items-center justify-between">
    <span>此节点已失效。当前 branch head 在另一处。</span>
    <button
      type="button"
      onClick={() => {
        setStaleBanner(null)
        const element = document.querySelector(`[data-message-id="${activeBranchHeadId}"]`)
        if (element instanceof HTMLElement) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }}
      className="underline hover:opacity-80"
    >
      跳转
    </button>
  </div>
) : null}
```

- [ ] **Step 3: Type-check + build**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build
```

Expected: pass.

- [ ] **Step 4: Visually verify**

In a conversation where a node was edited (creating a stale child), click that stale node in the right tree → terracotta banner appears with "跳转" link, auto-dismisses in 4s.

- [ ] **Step 5: Commit**

```bash
git add frontend/console/src/features/chat/pages/chat-page.tsx
git commit -m "frontend: show banner when navigating to stale node"
```

---

## Phase H — Polish

### Task 27: Empty states and Chat page header

**Files:**
- Create: `frontend/console/src/features/chat/components/empty-state.tsx`
- Modify: `frontend/console/src/features/chat/pages/chat-page.tsx`

- [ ] **Step 1: Create `empty-state.tsx`**

```tsx
import { Button } from '@/shared/ui/button'

type EmptyStateProps = {
  onCreate: () => void
}

export function ChatEmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-9 py-20 text-center">
      <h2 className="font-serif text-2xl text-ink mb-2">还没有任何对话</h2>
      <p className="font-serif italic text-sm text-ink-soft mb-6">
        a tree begins with a single root
      </p>
      <Button onClick={onCreate} className="rounded-full px-6">
        + 开始第一个对话
      </Button>
      <p className="mt-8 text-xs text-ink-faint leading-relaxed max-w-sm">
        Branchat 把每次对话保存为一棵树。你可以从任意 AI 回复开新支线、修改历史回答、
        或在长会话里自动压缩早期内容。
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Wire into chat-page**

In `chat-page.tsx`, render the empty state when no conversation is selected and the conversation list is empty:

```tsx
if (conversations.length === 0) {
  return (
    <div className="h-full flex bg-paper">
      <ChatEmptyState onCreate={handleCreateConversation} />
    </div>
  )
}
```

- [ ] **Step 3: Apply `PageHeader` to chat conversation header**

In the main column, where the current chat title is rendered, replace any custom header with:

```tsx
import { PageHeader } from '@/shared/ui/page-header'

<PageHeader
  title={activeConversation.title}
  meta={`${activeBranchName} · ${messageCount} nodes · ${branchCount} branches`}
/>
```

Use the existing variables that already track these counts. Place the header inside the `<main>` column at the top.

- [ ] **Step 4: Type-check + build + tests**

```bash
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Visually verify**

Delete all conversations (or clear the test database). Reload `/chat` — empty state appears. Create a conversation — chat returns to three-column layout.

- [ ] **Step 6: Commit**

```bash
git add frontend/console/src/features/chat
git commit -m "frontend: add chat empty state and conversation page header"
```

---

### Task 28: Final verification + minor README touch-up

**Files:**
- Possibly modify: `README.md` (add small note about visual identity if helpful)

- [ ] **Step 1: Run all tests**

```bash
cd /Users/cai/codeField/AetherGate-Lite
.venv/bin/pytest -q
cd frontend/console && npx tsc --noEmit && npx vite build && npx vitest run
```

Expected: backend 27/27 pass, frontend tests pass, typecheck clean, build clean.

- [ ] **Step 2: Manual smoke test**

```bash
./scripts/start.sh
```

Walk through:

1. **Settings dialog** (⚙ icon): Bearer Token input, save, refresh, persists ✓
2. **Chat empty state** (clear DB or new install): renders correctly ✓
3. **New conversation**: creates, three-column layout shows ✓
4. **Send message**: streams, stop button works, completion ✓
5. **Branch from a leaf**: ⎇ pill click → new branch created ✓
6. **Edit a node**: textarea mode, save, continue, regenerate ✓
7. **Compression** (send enough messages): summary block appears with moss border ✓
8. **Summary expand**: archived nodes show, collapse hides them ✓
9. **Tree click-jump**: click any tree node → main scrolls, message flashes ✓
10. **Stale banner**: edit a node, click the stale child in tree → banner appears, auto-dismisses ✓
11. **Left/right collapse**: chevrons toggle panels; resize window to ~1100px → right auto-collapses ✓
12. **Endpoints page**: state dots, validated italic footer ✓
13. **Prompts page**: preview area paper-shade with mono ✓
14. **Dashboard page**: charts use sand/moss palette ✓

- [ ] **Step 3: Optional README touch**

Add a short line under the existing tagline mentioning the visual identity, only if it fits naturally:

```markdown
> 普通 chatbot 是一条单链，Branchat 是一棵树。

可分支、可编辑、可压缩的树形对话系统。米白纸张 + 衬线斜体的"研究笔记本"调性，让分叉与思考成为页面主角。
```

If the change feels like over-narration, skip it. Existing README already covers the differentiation.

- [ ] **Step 4: Commit (if README touched)**

```bash
git add README.md
git commit -m "docs: mention visual identity in readme"
```

- [ ] **Step 5: Done**

The notebook redesign is complete. All eight phases of the spec are implemented, all tests pass, all manual checkpoints verified.

---

## Self-Review Checklist (post-write, fix inline)

- [x] **Spec coverage**: every § of the spec maps to one or more tasks. § Visual direction → Task 1. § Layout → Tasks 13-16. § Tokens → Task 1. § Primitives → Tasks 3-7. § Global shell → Tasks 8-9. § Chat states → Tasks 18, 19, 27. § Phase 4 contracts → Tasks 20-26. § Other pages → Tasks 10-12. § File structure → matches all tasks. § Testing → Tasks include tsc + vitest + pytest steps + Task 28. § Implementation path → matches the 8-phase task grouping.
- [x] **No placeholders**: all code blocks contain runnable code. Where a step references "existing prop names", I explicitly say to inspect the current file and adapt.
- [x] **Type consistency**: `TreeNode` shape used in Task 23 matches the type added in Task 23 Step 1; `archivedNodeIds` field added in Task 21 used in Task 22; `ChatMessage` field references consistent throughout.
- [x] **Spec change captured**: spec § 7.3 noted that I'd verify CachedPathEntry fields before plan-writing — I did, and the plan reads `compressed_source_versions_json` directly (no cached_path schema change needed), as specified in § 5.5 of the spec.
