import {
  PanelLeftOpen,
  Settings,
  Shield,
  X
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { cn } from '@/shared/lib/cn'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
import { useSessionStore } from '@/shared/stores/use-session-store'
import { Button } from '@/shared/ui/button'
import { SettingsDialog } from '@/shared/ui/settings-dialog'

const navigationItems = [
  {
    to: '/chat',
    label: '聊天'
  },
  {
    to: '/dashboard',
    label: '运行指标'
  },
  {
    to: '/endpoints',
    label: '入口点'
  },
  {
    to: '/prompts',
    label: '模板'
  }
] as const

const pageMeta = {
  '/chat': {
    title: '聊天',
    subtitle: '在树形对话中分叉、编辑、重生与压缩历史。'
  },
  '/dashboard': {
    title: '运行指标',
    subtitle: '查看后端调用的请求指标、趋势统计和最近日志。'
  },
  '/endpoints': {
    title: '入口点',
    subtitle: '统一管理接入模型、启停状态和验证结果。'
  },
  '/prompts': {
    title: '模板',
    subtitle: '维护 Prompt 模板，供控制台和网关请求复用。'
  }
} as const

export function AppShell() {
  const location = useLocation()
  const token = useSessionStore((state) => state.token)
  const { hasHydrated, hasToken } = useApiAccessState()
  const { mobileNavOpen, setMobileNavOpen, toggleMobileNav } = useConsoleUiStore()
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [didAutoPromptForToken, setDidAutoPromptForToken] = useState(false)

  const currentPage = (() => {
    if (location.pathname.startsWith('/chat')) return pageMeta['/chat']
    if (location.pathname.startsWith('/endpoints')) return pageMeta['/endpoints']
    if (location.pathname.startsWith('/prompts')) return pageMeta['/prompts']
    return pageMeta['/dashboard']
  })()

  const isChatPage = location.pathname.startsWith('/chat')

  // Auto-prompt for token when not configured
  if (hasHydrated && !hasToken && !didAutoPromptForToken) {
    setTokenDialogOpen(true)
    setDidAutoPromptForToken(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop topbar — hidden on mobile */}
      <header className="hidden lg:flex h-14 bg-paper-warm border-b border-rule px-6 items-center justify-between sticky top-0 z-40">
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
            onClick={() => setTokenDialogOpen(true)}
            className="ml-2 p-1.5 text-ink-soft hover:text-ink rounded-md hover:bg-paper-shade transition-colors"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
        </nav>
      </header>

      {/* Mobile header — visible only on mobile */}
      {/* TODO: restyle mobile header to match notebook aesthetic (non-goal per spec) */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-[60px] items-center px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={toggleMobileNav}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border hover:bg-panel hover:text-foreground"
              aria-label="切换导航"
            >
              {mobileNavOpen ? <X className="size-5" /> : <PanelLeftOpen className="size-5" />}
            </button>

            <div className="flex items-baseline gap-2">
              <span className="font-serif text-sm text-ink">Branchat</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTokenDialogOpen(true)}>
              <Shield className="size-4" />
              {!hasHydrated ? '恢复会话中' : token ? '已配置 Token' : '配置 Token'}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-[#111318]/20 backdrop-blur-[1px] lg:hidden"
          aria-label="关闭导航"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Mobile nav drawer */}
      {mobileNavOpen ? (
        <aside className="fixed left-0 top-[61px] bottom-0 z-30 w-[248px] flex flex-col border-r border-border bg-background/98 px-3 py-4 lg:hidden">
          <nav className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-14 w-full items-center gap-3 px-4 overflow-hidden rounded-[24px] text-left transition-colors',
                      isActive
                        ? 'bg-accent-soft text-foreground'
                        : 'text-foreground-soft hover:bg-panel-strong hover:text-foreground'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </aside>
      ) : null}

      {/* Warning banner — no token */}
      {hasHydrated && !hasToken ? (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6 lg:px-8">
          当前尚未配置 Bearer Token。控制台已暂停受保护接口请求，请先点击右上角"配置 Token"。
        </div>
      ) : null}

      {/* Main content area */}
      <div
        className={cn(
          isChatPage
            ? 'h-[calc(100vh-56px)] min-h-0 overflow-hidden'
            : 'min-h-[calc(100vh-56px)]'
        )}
      >
        <main
          className={cn(
            'flex flex-col',
            isChatPage ? 'h-full min-h-0 overflow-hidden' : 'px-4 py-4 sm:px-5 lg:px-6 xl:px-8'
          )}
        >
          {isChatPage ? null : (
            <section className="mb-4">
              <div className="text-[32px] font-semibold tracking-[-0.05em] text-foreground">
                {currentPage.title}
              </div>
              <p className="mt-1 max-w-3xl text-[14px] text-muted-foreground">
                {currentPage.subtitle}
              </p>
            </section>
          )}

          <Outlet />
        </main>
      </div>

      <SettingsDialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen} />
    </div>
  )
}
