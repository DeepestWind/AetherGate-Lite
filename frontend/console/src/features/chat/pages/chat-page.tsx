import dayjs from 'dayjs'
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  PanelLeft,
  Plus,
  Settings2,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultChatConfig } from '@/features/chat/chat-types'
import { ControlPanel } from '@/features/chat/components/control-panel'
import { InputArea } from '@/features/chat/components/input-area'
import { MessageList } from '@/features/chat/components/message-list'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import { useChatModelsQuery } from '@/features/chat/queries/use-chat-models-query'
import { useChatPromptsQuery } from '@/features/chat/queries/use-chat-prompts-query'
import { useChatUiStore } from '@/features/chat/stores/use-chat-ui-store'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { cn } from '@/shared/lib/cn'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

function formatSessionTime(value: number) {
  if (dayjs(value).isSame(dayjs(), 'day')) {
    return dayjs(value).format('HH:mm')
  }

  return dayjs(value).format('MM-DD')
}

function getSessionPreview(message: string | undefined) {
  if (!message) {
    return '等待第一条消息'
  }

  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 32) {
    return normalized
  }

  return `${normalized.slice(0, 32)}…`
}

export function ChatPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const modelsQuery = useChatModelsQuery()
  const promptsQuery = useChatPromptsQuery()
  const session = useChatSession(hasToken)
  const { config, inputDraft, setConfig, setConfigField, setInputDraft, setVariables } =
    useChatUiStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const saveDraftConfigRef = useRef(session.saveDraftConfig)
  const lastSyncedSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    saveDraftConfigRef.current = session.saveDraftConfig
  }, [session.saveDraftConfig])

  useEffect(() => {
    if (!config.model && (modelsQuery.data?.length ?? 0) > 0) {
      setConfigField('model', modelsQuery.data?.[0] ?? '')
    }
  }, [config.model, modelsQuery.data, setConfigField])

  useEffect(() => {
    if (!session.activeSession) {
      lastSyncedSessionIdRef.current = null
      return
    }

    if (lastSyncedSessionIdRef.current === session.activeSession.id) {
      return
    }

    lastSyncedSessionIdRef.current = session.activeSession.id
    setConfig({
      ...session.activeSession.draftConfig,
      variables: { ...session.activeSession.draftConfig.variables }
    })
    setInputDraft('')
  }, [session.activeSession, setConfig, setInputDraft])

  const activeDraftConfigKey = JSON.stringify(
    session.activeSession?.draftConfig ?? defaultChatConfig
  )
  const currentDraftConfigKey = JSON.stringify(config)

  useEffect(() => {
    if (!session.activeSession || session.initializing) {
      return
    }

    if (currentDraftConfigKey === activeDraftConfigKey) {
      return
    }

    const timeout = window.setTimeout(() => {
      void saveDraftConfigRef.current(config)
    }, 400)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    activeDraftConfigKey,
    config,
    currentDraftConfigKey,
    session.activeSession,
    session.initializing
  ])

  const orderedSessions = useMemo(
    () => [...session.sessions].sort((left, right) => right.updatedAt - left.updatedAt),
    [session.sessions]
  )

  const handleSend = async () => {
    const content = inputDraft.trim()
    if (!content || session.sending || !config.model) {
      return
    }

    setInputDraft('')
    await session.sendChat(content, config)
  }

  const handleClearChat = () => {
    if (!session.messages.length) {
      return
    }

    if (window.confirm('确定清空当前会话吗？该操作不可撤销。')) {
      void session.clearChat()
    }
  }

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('确定删除这个会话吗？该操作不可撤销。')) {
      void session.deleteSession(sessionId)
    }
  }

  const handleToggleRail = () => {
    const nextCollapsed = !sessionRailCollapsed
    setSessionRailCollapsed(nextCollapsed)
    if (nextCollapsed) {
      setSettingsOpen(false)
    }
  }

  const handleToggleSettings = () => {
    if (sessionRailCollapsed) {
      setSessionRailCollapsed(false)
    }
    setSettingsOpen((current) => !current)
  }

  if (!hasHydrated || session.initializing) {
    return <div className="flex-1 animate-pulse bg-secondary" />
  }

  if (!hasToken) {
    return (
      <div className="px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
        <AuthRequiredState description="聊天页需要访问 /v1/models、/api/prompts 和 /v1/chat/completions，请先配置 Bearer Token。" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[61px] z-20 bg-[#111318]/28 backdrop-blur-[1px] lg:hidden"
          aria-label="关闭会话面板"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[61px] z-30 flex w-[292px] max-w-[calc(100vw-24px)] flex-col border-r border-border bg-panel/96 backdrop-blur-xl transition-[width,transform] duration-200 ease-out lg:static lg:z-0 lg:h-full lg:max-w-none lg:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sessionRailCollapsed ? 'lg:w-[92px]' : 'lg:w-[292px]'
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/80 px-3 py-3">
          <Button
            className={cn('flex-1 justify-start', sessionRailCollapsed && 'lg:flex-none lg:px-0')}
            onClick={() => {
              void session.createSession(config)
              setMobileSidebarOpen(false)
            }}
            disabled={session.sending}
          >
            <Plus className="size-4" />
            <span className={cn(sessionRailCollapsed && 'lg:hidden')}>新建会话</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={handleToggleRail}
            aria-label={sessionRailCollapsed ? '展开会话栏' : '折叠会话栏'}
          >
            {sessionRailCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="关闭会话栏"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div
          className={cn(
            'flex items-center justify-between px-3 pb-2 pt-3',
            sessionRailCollapsed && 'lg:justify-center'
          )}
        >
          <div
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
              sessionRailCollapsed && 'lg:hidden'
            )}
          >
            会话
          </div>
          <Badge variant="outline" className={cn(sessionRailCollapsed && 'lg:hidden')}>
            {orderedSessions.length}
          </Badge>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-3',
            settingsOpen ? 'pb-[32rem]' : 'pb-24'
          )}
        >
          <div className="space-y-2">
            {orderedSessions.map((chatSession, index) => {
              const isActive = chatSession.id === session.activeSessionId

              return (
                <div
                  key={chatSession.id}
                  className={cn(
                    'group flex w-full items-start rounded-[22px] border text-left transition',
                    isActive
                      ? 'border-accent/30 bg-accent/10 shadow-[0_16px_42px_-32px_rgba(223,90,79,0.72)]'
                      : 'border-transparent bg-background/72 hover:border-border hover:bg-background'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      session.selectSession(chatSession.id)
                      setMobileSidebarOpen(false)
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-start gap-3 p-3',
                      sessionRailCollapsed && 'lg:justify-center lg:px-2'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold',
                        isActive
                          ? 'border-accent/20 bg-accent text-white'
                          : 'border-border bg-panel text-muted-foreground'
                      )}
                    >
                      {sessionRailCollapsed ? (
                        <MessageSquareText className="size-4" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </div>

                    <div className={cn('min-w-0 flex-1', sessionRailCollapsed && 'lg:hidden')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {chatSession.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {getSessionPreview(
                              chatSession.lastMessagePreview ?? chatSession.messages.at(-1)?.content
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatSessionTime(chatSession.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className={cn('px-2 py-2', sessionRailCollapsed && 'lg:hidden')}>
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-panel hover:text-foreground"
                      aria-label={`删除 ${chatSession.title}`}
                      onClick={() => handleDeleteSession(chatSession.id)}
                      disabled={session.sending}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-border/80 px-3 py-3">
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between',
              sessionRailCollapsed && 'lg:justify-center lg:px-0'
            )}
            onClick={handleToggleSettings}
          >
            <span className="inline-flex items-center gap-2">
              <Settings2 className="size-4" />
              <span className={cn(sessionRailCollapsed && 'lg:hidden')}>路由与参数</span>
            </span>
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                settingsOpen && 'rotate-90',
                sessionRailCollapsed && 'lg:hidden'
              )}
            />
          </Button>
        </div>

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 transition-transform duration-200 ease-out',
            settingsOpen ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'
          )}
        >
          <div className="rounded-t-[28px] border-t border-border bg-background px-3 pb-3 pt-2 shadow-[0_-24px_80px_-40px_rgba(15,23,42,0.48)]">
            <button
              type="button"
              className="mx-auto flex h-10 w-full items-center justify-center"
              onClick={handleToggleSettings}
              aria-label={settingsOpen ? '收起路由与参数' : '展开路由与参数'}
            >
              <span className="h-1.5 w-12 rounded-full bg-border" />
            </button>

            <div className="max-h-[min(70vh,680px)] overflow-y-auto pb-2">
              <ControlPanel
                className="rounded-[26px] border border-border bg-panel p-4 shadow-panel"
                config={config}
                availableModels={modelsQuery.data ?? []}
                promptTemplates={promptsQuery.data ?? []}
                callInfo={session.lastCallInfo}
                onChange={setConfigField}
                onVariablesChange={setVariables}
              />
            </div>
          </div>
        </div>
      </aside>

      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(223,90,79,0.08),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.72),_rgba(255,255,255,0)_14%)] dark:bg-[radial-gradient(circle_at_top,_rgba(223,90,79,0.18),_transparent_36%),linear-gradient(180deg,_rgba(17,19,24,0.8),_rgba(17,19,24,0)_18%)]">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 bg-background/86 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="打开会话栏"
              >
                <PanelLeft className="size-4" />
              </Button>
              <div className="truncate text-lg font-semibold tracking-[-0.04em] text-foreground">
                {session.activeSession?.title ?? '新对话'}
              </div>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {config.model
                ? `${config.model} · ${session.messages.length} 条消息`
                : '先选择逻辑模型，再开始新的聊天会话。'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {config.model ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {config.model}
              </Badge>
            ) : null}
            <Badge variant="outline">{session.messages.length} 条消息</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={!session.messages.length}
            >
              <Trash2 className="size-4" />
              清空
            </Button>
          </div>
        </header>

        {modelsQuery.isError || promptsQuery.isError ? (
          <div className="border-b border-border bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6">
            模型或 Prompt 选项加载失败。你仍然可以直接发送消息，但下拉选项可能不完整。
          </div>
        ) : null}

        {!config.model && !modelsQuery.isLoading ? (
          <div className="border-b border-border bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6">
            当前没有可用逻辑模型。请先到 Endpoint 页面创建并启用至少一个 Endpoint。
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <MessageList messages={session.messages} />
        </div>

        <InputArea
          value={inputDraft}
          sending={session.sending || !config.model}
          onChange={setInputDraft}
          onSend={handleSend}
        />
      </section>
    </div>
  )
}
