import {
  BarChart3,
  Link2,
  MessageSquare,
  Minus,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Sparkles,
  SunMedium,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { cn } from '@/shared/lib/cn'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
import { useSessionStore } from '@/shared/stores/use-session-store'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'

type ThemeMode = 'light' | 'dark' | 'system'

const navigationGroups = [
  {
    key: 'chat',
    label: '聊天',
    items: [
      {
        to: '/chat',
        label: '聊天',
        icon: MessageSquare
      }
    ]
  },
  {
    key: 'control',
    label: '控制',
    items: [
      {
        to: '/dashboard',
        label: '概览',
        icon: BarChart3
      },
      {
        to: '/endpoints',
        label: '入口点',
        icon: Link2
      },
      {
        to: '/prompts',
        label: '模板',
        icon: Sparkles
      }
    ]
  }
] as const

const pageMeta = {
  '/chat': {
    title: '聊天',
    subtitle: '验证模型路由、Prompt 注入和实时响应链路。'
  },
  '/dashboard': {
    title: '概览',
    subtitle: '查看请求指标、趋势统计和最近日志。'
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

const themeChoices: Array<{
  label: string
  mode: ThemeMode
  icon: typeof Monitor
}> = [
  { label: 'System', mode: 'system', icon: Monitor },
  { label: 'Light', mode: 'light', icon: SunMedium },
  { label: 'Dark', mode: 'dark', icon: Moon }
]

function resolveTheme(mode: ThemeMode) {
  if (mode !== 'system') {
    return mode
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

function ThemeToggle({
  themeMode,
  onChange
}: {
  onChange: (next: ThemeMode) => void
  themeMode: ThemeMode
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-panel p-1 shadow-card">
      {themeChoices.map(({ label, mode, icon: Icon }) => {
        const active = themeMode === mode

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full transition',
              active
                ? 'bg-accent text-white shadow-[0_10px_20px_-14px_rgba(223,90,79,0.88)]'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            aria-label={label}
            title={label}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}

function BrandMark() {
  return (
    <div className="relative flex size-8 items-center justify-center">
      <span className="absolute inset-[4px] rounded-full bg-accent/18" />
      <span className="absolute inset-[7px] rounded-full bg-accent" />
      <span className="absolute left-1 top-2.5 size-1.5 rounded-full bg-accent" />
      <span className="absolute right-1 top-2.5 size-1.5 rounded-full bg-accent" />
      <span className="absolute bottom-1 left-2.5 size-1 rounded-full bg-accent" />
      <span className="absolute bottom-1 right-2.5 size-1 rounded-full bg-accent" />
    </div>
  )
}

function TokenDialog({
  onOpenChange,
  open
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { clearToken, setToken, token } = useSessionStore()
  const [draft, setDraft] = useState(token)

  useEffect(() => {
    if (open) {
      setDraft(token)
    }
  }, [open, token])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>访问凭证</DialogTitle>
          <DialogDescription>
            管理接口和内部观测接口都需要 Bearer Token。这里的值只保存在当前浏览器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label htmlFor="console-token" className="text-sm font-medium">
            Bearer Token
          </label>
          <Input
            id="console-token"
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="请输入 config.toml 中的 auth_token"
          />
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearToken()
              setDraft('')
            }}
          >
            清空
          </Button>
          <Button
            type="button"
            onClick={() => {
              setToken(draft)
              onOpenChange(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AppShell() {
  const location = useLocation()
  const token = useSessionStore((state) => state.token)
  const { hasHydrated, hasToken } = useApiAccessState()
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [didAutoPromptForToken, setDidAutoPromptForToken] = useState(false)
  const {
    mobileNavOpen,
    navGroupsCollapsed,
    setMobileNavOpen,
    setThemeMode,
    sidebarCollapsed,
    themeMode,
    toggleNavGroup,
    toggleSidebar
  } = useConsoleUiStore()

  const currentPage = useMemo(() => {
    if (location.pathname.startsWith('/chat')) {
      return pageMeta['/chat']
    }
    if (location.pathname.startsWith('/endpoints')) {
      return pageMeta['/endpoints']
    }
    if (location.pathname.startsWith('/prompts')) {
      return pageMeta['/prompts']
    }
    return pageMeta['/dashboard']
  }, [location.pathname])

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(themeMode)
    }

    applyTheme()

    if (themeMode !== 'system') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [themeMode])

  useEffect(() => {
    if (!hasHydrated || hasToken || didAutoPromptForToken) {
      return
    }

    setTokenDialogOpen(true)
    setDidAutoPromptForToken(true)
  }, [didAutoPromptForToken, hasHydrated, hasToken])

  const handleNavToggle = () => {
    if (window.innerWidth < 1024) {
      setMobileNavOpen(!mobileNavOpen)
      return
    }

    toggleSidebar()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="flex min-h-[60px] items-center px-4 sm:px-6 lg:px-0">
          <div
            className={cn(
              'flex items-center transition-[width] duration-200 ease-out lg:min-h-[60px] lg:border-r lg:border-border',
              sidebarCollapsed ? 'lg:w-[76px] lg:justify-center' : 'lg:w-[224px] lg:justify-end'
            )}
          >
            <button
              type="button"
              onClick={handleNavToggle}
              className={cn(
                'inline-flex size-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border hover:bg-panel hover:text-foreground',
                sidebarCollapsed ? 'lg:mx-auto' : 'lg:mr-4'
              )}
              aria-label="切换导航"
            >
              {mobileNavOpen ? (
                <X className="size-5 lg:hidden" />
              ) : sidebarCollapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-3 px-4 lg:px-5">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold uppercase tracking-[0.08em] text-foreground">
                AETHERGATE LITE
              </div>
              <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Personal Gateway Console
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 overflow-x-auto py-2 lg:px-8">
            <Button variant="outline" size="sm" onClick={() => setTokenDialogOpen(true)}>
              <Shield className="size-4" />
              {!hasHydrated ? '恢复会话中' : token ? '已配置 Token' : '配置 Token'}
            </Button>
            <ThemeToggle themeMode={themeMode} onChange={setThemeMode} />
          </div>
        </div>
      </header>

      {hasHydrated && !hasToken ? (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6 lg:px-8">
          当前尚未配置 Bearer Token。控制台已暂停受保护接口请求，请先点击右上角“配置 Token”。
        </div>
      ) : null}

      <div className="relative flex min-h-[calc(100vh-60px)]">
        {mobileNavOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-[#111318]/20 backdrop-blur-[1px] lg:hidden"
            aria-label="关闭导航"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            'fixed inset-y-[60px] left-0 z-30 flex w-[224px] flex-col border-r border-border bg-background/98 px-3 py-4 transition-[width,padding,transform] duration-200 ease-out lg:static lg:inset-y-auto lg:z-0 lg:bg-transparent',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed ? 'lg:w-[76px] lg:px-2' : 'lg:w-[224px] lg:px-3'
          )}
        >
          <nav className="flex-1 overflow-y-auto">
            {navigationGroups.map((group) => {
              const collapsed = navGroupsCollapsed[group.key]

              return (
                <section key={group.key} className="mb-3 last:mb-0">
                  <button
                    type="button"
                    onClick={() => toggleNavGroup(group.key)}
                    className={cn(
                      'mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold tracking-[0.06em] text-muted-foreground transition hover:bg-secondary hover:text-foreground',
                      sidebarCollapsed && 'lg:justify-center lg:px-0'
                    )}
                  >
                    <span>{group.label}</span>
                    <span className={cn('text-sm', sidebarCollapsed && 'lg:hidden')}>
                      {collapsed ? '+' : <Minus className="size-4" />}
                    </span>
                  </button>

                  <div className={cn('space-y-0.5', collapsed && 'hidden')}>
                    {group.items.map((item) => {
                      const Icon = item.icon

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileNavOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 overflow-hidden border transition',
                              sidebarCollapsed
                                ? 'mx-auto size-12 justify-center rounded-2xl px-0 py-0'
                                : 'justify-start rounded-xl px-3 py-2.5',
                              isActive
                                ? 'border-accent/10 bg-accent-soft text-foreground'
                                : 'border-transparent text-foreground-soft hover:bg-panel-strong hover:text-foreground'
                            )
                          }
                        >
                          <span
                            className={cn(
                              'inline-flex size-5 items-center justify-center text-muted-foreground',
                              location.pathname.startsWith(item.to) && 'text-accent'
                            )}
                          >
                            <Icon className="size-[15px]" />
                          </span>
                          <span
                            className={cn(
                              'whitespace-nowrap text-[14px] font-medium transition-all duration-200 ease-out',
                              sidebarCollapsed
                                ? 'lg:max-w-0 lg:translate-x-[-8px] lg:opacity-0'
                                : 'lg:max-w-[120px] lg:translate-x-0 lg:opacity-100'
                            )}
                          >
                            {item.label}
                          </span>
                        </NavLink>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <main className="px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
            <section className="mb-4">
              <div className="text-[32px] font-semibold tracking-[-0.05em] text-foreground">
                {currentPage.title}
              </div>
              <p className="mt-1 max-w-3xl text-[14px] text-muted-foreground">
                {currentPage.subtitle}
              </p>
            </section>

            <Outlet />
          </main>
        </div>
      </div>

      <TokenDialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen} />
    </div>
  )
}
