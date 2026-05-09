import {
  BarChart3,
  Link2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Sparkles,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { cn } from '@/shared/lib/cn'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
import { useSessionStore } from '@/shared/stores/use-session-store'
import { Button } from '@/shared/ui/button'
import { SettingsDialog } from '@/shared/ui/settings-dialog'

const SIDEBAR_LABEL_REVEAL_MS = 130

const navigationItems = [
  {
    to: '/chat',
    label: '聊天',
    icon: MessageSquare
  },
  {
    to: '/dashboard',
    label: '运行指标',
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

function DesktopSidebarFooter({
  hasHydrated,
  hasToken,
  labelVisible,
  onOpenTokenDialog,
  sidebarCollapsed
}: {
  hasHydrated: boolean
  hasToken: boolean
  labelVisible: boolean
  onOpenTokenDialog: () => void
  sidebarCollapsed: boolean
}) {
  const compact = sidebarCollapsed || !labelVisible

  return (
    <div
      className={cn(
        'hidden border-t border-border pt-3 lg:flex lg:flex-col lg:gap-3',
        compact ? 'items-center px-2' : 'px-3'
      )}
    >
      <Button
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        className={cn(compact ? 'size-11 rounded-[18px]' : 'w-full justify-start')}
        onClick={onOpenTokenDialog}
        aria-label="配置 Token"
      >
        <Shield className="size-4" />
        {compact ? null : !hasHydrated ? '恢复会话中' : hasToken ? '已配置 Token' : '配置 Token'}
      </Button>
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

function BrandRail({
  collapsed,
  labelVisible,
  onToggle
}: {
  collapsed: boolean
  labelVisible: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'hidden items-center transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex',
        collapsed ? 'px-0' : 'px-0'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group flex h-12 w-full items-center overflow-hidden rounded-[22px] transition-[padding,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-secondary',
          collapsed ? 'px-[14px]' : 'px-3'
        )}
        aria-label={collapsed ? '展开主菜单' : '折叠主菜单'}
      >
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-[16px]">
          <span
            className={cn(
              'transition-opacity duration-200 ease-out',
              collapsed && 'group-hover:opacity-0'
            )}
          >
            <BrandMark />
          </span>
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-muted-foreground transition-opacity duration-200 ease-out',
              collapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
            )}
          >
            <PanelLeftOpen className="size-5" />
          </span>
        </span>

        <div
          className={cn(
            'min-w-0 overflow-hidden text-left transition-[max-width,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed || !labelVisible
              ? 'ml-0 max-w-0 -translate-x-2 opacity-0'
              : 'ml-3 max-w-[148px] translate-x-0 opacity-100'
          )}
        >
          <div className="truncate text-[15px] font-semibold tracking-[0.01em] text-foreground">
            Branchat
          </div>
        </div>

        <span
          className={cn(
            'ml-auto inline-flex items-center justify-center overflow-hidden rounded-[14px] text-muted-foreground transition-[width,opacity,transform,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-background group-hover:text-foreground',
            collapsed || !labelVisible
              ? 'w-0 opacity-0 translate-x-2'
              : 'size-9 opacity-100 translate-x-0'
          )}
        >
          <PanelLeftClose className="size-4 shrink-0" />
        </span>
      </button>
    </div>
  )
}


export function AppShell() {
  const location = useLocation()
  const token = useSessionStore((state) => state.token)
  const { hasHydrated, hasToken } = useApiAccessState()
  const {
    collapseSidebar,
    expandSidebar,
    mobileNavOpen,
    setMobileNavOpen,
    sidebarCollapsed,
    toggleMobileNav
  } = useConsoleUiStore()
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [didAutoPromptForToken, setDidAutoPromptForToken] = useState(false)
  const [sidebarLabelVisible, setSidebarLabelVisible] = useState(() => !sidebarCollapsed)
  const hasMountedRef = useRef(false)
  const labelTimerRef = useRef<number | null>(null)
  const collapseFrameRef = useRef<number | null>(null)

  const clearSidebarTransitionTimers = useCallback(() => {
    if (labelTimerRef.current !== null) {
      window.clearTimeout(labelTimerRef.current)
      labelTimerRef.current = null
    }

    if (collapseFrameRef.current !== null) {
      window.cancelAnimationFrame(collapseFrameRef.current)
      collapseFrameRef.current = null
    }
  }, [])

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
  const isChatPage = location.pathname.startsWith('/chat')

  useEffect(() => {
    if (!hasHydrated || hasToken || didAutoPromptForToken) {
      return
    }

    setTokenDialogOpen(true)
    setDidAutoPromptForToken(true)
  }, [didAutoPromptForToken, hasHydrated, hasToken])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      setSidebarLabelVisible(!sidebarCollapsed)
      return
    }

    clearSidebarTransitionTimers()

    if (sidebarCollapsed) {
      setSidebarLabelVisible(false)
      return
    }

    setSidebarLabelVisible(false)
    labelTimerRef.current = window.setTimeout(() => {
      setSidebarLabelVisible(true)
      labelTimerRef.current = null
    }, SIDEBAR_LABEL_REVEAL_MS)

    return () => {
      clearSidebarTransitionTimers()
    }
  }, [clearSidebarTransitionTimers, sidebarCollapsed])

  const handleNavToggle = () => {
    if (window.innerWidth < 1024) {
      toggleMobileNav()
      return
    }

    clearSidebarTransitionTimers()

    if (sidebarCollapsed) {
      expandSidebar()
      labelTimerRef.current = window.setTimeout(() => {
        setSidebarLabelVisible(true)
        labelTimerRef.current = null
      }, SIDEBAR_LABEL_REVEAL_MS)
      return
    }

    setSidebarLabelVisible(false)
    collapseFrameRef.current = window.requestAnimationFrame(() => {
      collapseSidebar()
      collapseFrameRef.current = null
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-[60px] items-center px-4 sm:px-6 lg:px-0">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={handleNavToggle}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border hover:bg-panel hover:text-foreground"
              aria-label="切换导航"
            >
              {mobileNavOpen ? <X className="size-5" /> : <PanelLeftOpen className="size-5" />}
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <div className="min-w-0 truncate text-[13px] font-semibold tracking-[0.01em] text-foreground">
                Branchat
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 overflow-x-auto py-2">
            <Button variant="outline" size="sm" onClick={() => setTokenDialogOpen(true)}>
              <Shield className="size-4" />
              {!hasHydrated ? '恢复会话中' : token ? '已配置 Token' : '配置 Token'}
            </Button>
          </div>
        </div>
      </header>

      {hasHydrated && !hasToken ? (
        <div className="border-b border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6 lg:px-8">
          当前尚未配置 Bearer Token。控制台已暂停受保护接口请求，请先点击右上角“配置 Token”。
        </div>
      ) : null}

      <div
        className={cn(
          'relative flex',
          isChatPage
            ? 'h-[calc(100vh-61px)] min-h-0 overflow-hidden lg:h-screen'
            : 'min-h-[calc(100vh-61px)] items-start lg:min-h-screen'
        )}
      >
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
            'fixed bottom-0 left-0 top-[61px] z-30 flex w-[248px] flex-col border-r border-border bg-background/98 px-3 py-4 transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:bg-background/92',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed ? 'lg:w-[92px]' : 'lg:w-[248px]'
          )}
        >
          <div className="hidden pb-4 lg:block">
            <BrandRail
              collapsed={sidebarCollapsed}
              labelVisible={sidebarLabelVisible}
              onToggle={handleNavToggle}
            />
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex h-14 w-full items-center overflow-hidden rounded-[24px] text-left transition-[padding,gap,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                        sidebarCollapsed ? 'gap-0 px-6' : 'gap-3 px-4',
                        isActive
                          ? 'bg-accent-soft text-foreground'
                          : 'text-foreground-soft hover:bg-panel-strong hover:text-foreground'
                      )
                    }
                  >
                    <span
                      className={cn(
                        'inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-200',
                        location.pathname.startsWith(item.to) && 'text-accent'
                      )}
                    >
                      <Icon className="size-[15px]" />
                    </span>
                    <span
                      className={cn(
                        'min-w-0 overflow-hidden whitespace-nowrap text-[15px] font-medium transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                        sidebarCollapsed || !sidebarLabelVisible
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
          </nav>

          <DesktopSidebarFooter
            hasHydrated={hasHydrated}
            hasToken={hasToken}
            labelVisible={sidebarLabelVisible}
            onOpenTokenDialog={() => setTokenDialogOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
          />
        </aside>

        <div className={cn('min-w-0 flex-1', isChatPage && 'min-h-0')}>
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
      </div>

      <SettingsDialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen} />
    </div>
  )
}
