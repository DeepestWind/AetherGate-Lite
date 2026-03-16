import { PanelLeftOpen, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/features/chat/chat-types'
import { defaultChatConfig } from '@/features/chat/chat-types'
import { AdvancedSettingsDrawer } from '@/features/chat/components/advanced-settings-drawer'
import { InputArea } from '@/features/chat/components/input-area'
import { MessageList } from '@/features/chat/components/message-list'
import { SessionSidebar } from '@/features/chat/components/session-sidebar'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import { useChatModelsQuery } from '@/features/chat/queries/use-chat-models-query'
import { useChatPromptsQuery } from '@/features/chat/queries/use-chat-prompts-query'
import { useChatUiStore } from '@/features/chat/stores/use-chat-ui-store'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { cn } from '@/shared/lib/cn'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog'

type PendingConfirmation = {
  confirmLabel: string
  description: string
  onConfirm: () => Promise<void> | void
  title: string
  tone?: 'danger' | 'default'
} | null

export function ChatPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const modelsQuery = useChatModelsQuery()
  const promptsQuery = useChatPromptsQuery()
  const session = useChatSession(hasToken)
  const { config, inputDraft, setConfig, setConfigField, setInputDraft, setVariables } =
    useChatUiStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null)
  const [pinnedMessagesBySession, setPinnedMessagesBySession] = useState<Record<string, string[]>>(
    {}
  )
  const saveDraftConfigRef = useRef(session.saveDraftConfig)
  const lastSyncedSessionIdRef = useRef<string | null>(null)
  const pendingInputDraftRef = useRef<string | null>(null)

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
    setInputDraft(pendingInputDraftRef.current ?? '')
    pendingInputDraftRef.current = null
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
  const activeSessionId = session.activeSessionId
  const pinnedMessageIds = useMemo(
    () => new Set(activeSessionId ? (pinnedMessagesBySession[activeSessionId] ?? []) : []),
    [activeSessionId, pinnedMessagesBySession]
  )
  const desktopChatSidebarVisible = desktopSidebarOpen

  const sendDisabled = !inputDraft.trim() || session.sending || !config.model

  const handleSend = async () => {
    const content = inputDraft.trim()
    if (!content || session.sending || !config.model) {
      return
    }

    setInputDraft('')
    await session.sendChat(content, config)
  }

  const handleCreateSession = async () => {
    await session.createSession(config)
    setMobileSidebarOpen(false)
  }

  const focusComposer = () => {
    window.requestAnimationFrame(() => {
      const composer = document.querySelector<HTMLTextAreaElement>('[data-chat-composer]')
      composer?.focus()
      composer?.setSelectionRange(composer.value.length, composer.value.length)
    })
  }

  const handleSelectSession = (sessionId: string) => {
    void session.selectSession(sessionId)
    setMobileSidebarOpen(false)
  }

  const handleDeleteSession = (sessionId: string) => {
    const targetSession = session.sessions.find((item) => item.id === sessionId)

    setPendingConfirmation({
      confirmLabel: '删除会话',
      description: `会话“${targetSession?.title ?? '未命名会话'}”及其中的消息会被永久删除，且无法恢复。`,
      onConfirm: () => session.deleteSession(sessionId),
      title: '删除这个会话？',
      tone: 'danger'
    })
  }

  const handleRenameSession = async (sessionId: string, title: string) => {
    await session.renameSession(sessionId, title)
  }

  const handleEditMessage = (message: ChatMessage) => {
    setInputDraft(message.content)
    focusComposer()
  }

  const handleBranchMessage = async (message: ChatMessage) => {
    pendingInputDraftRef.current = message.content

    try {
      await session.createSession(config)
      setMobileSidebarOpen(false)
      toast.success('已创建新分支，会话内容已放入输入框')
      focusComposer()
    } catch {
      pendingInputDraftRef.current = null
      toast.error('创建分支失败，请稍后重试')
    }
  }

  const handleTogglePinMessage = (message: ChatMessage) => {
    if (!activeSessionId) {
      return
    }

    let nextPinned = false

    setPinnedMessagesBySession((current) => {
      const currentIds = current[activeSessionId] ?? []
      const hasPinned = currentIds.includes(message.id)
      const nextIds = hasPinned
        ? currentIds.filter((item) => item !== message.id)
        : [...currentIds, message.id]

      nextPinned = !hasPinned

      return {
        ...current,
        [activeSessionId]: nextIds
      }
    })

    toast.success(nextPinned ? '已标记消息' : '已取消标记')
  }

  const handleOpenChatSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((current) => !current)
      return
    }

    setDesktopSidebarOpen(true)
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
          className="fixed inset-x-0 bottom-0 top-[61px] z-20 bg-[#101216]/18 backdrop-blur-[1px] lg:hidden"
          aria-label="关闭会话面板"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[61px] z-30 max-w-[calc(100vw-32px)] border-r border-border bg-[#fcfcfb] transition-[transform,width,border-color,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:top-0 lg:z-0 lg:h-full lg:max-w-none lg:shrink-0 lg:overflow-hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          desktopChatSidebarVisible
            ? 'w-[280px] opacity-100'
            : 'lg:w-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none'
        )}
      >
        <div className="h-full w-[280px] max-w-[calc(100vw-32px)]">
          <SessionSidebar
            activeSessionId={session.activeSessionId}
            onCreate={() => void handleCreateSession()}
            onCollapse={() => setDesktopSidebarOpen(false)}
            onDelete={handleDeleteSession}
            onRename={handleRenameSession}
            onSelect={handleSelectSession}
            sending={session.sending}
            sessions={orderedSessions}
          />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/96 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(desktopChatSidebarVisible && 'lg:hidden')}
                onClick={handleOpenChatSidebar}
                aria-label="展开聊天栏"
              >
                <PanelLeftOpen className="size-4" />
              </Button>

              <div className="min-w-0">
                <div className="truncate text-[22px] font-semibold tracking-[-0.05em] text-foreground">
                  {session.activeSession?.title ?? '新对话'}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {session.messages.length
                    ? `${session.messages.length} 条消息`
                    : '从左侧选择会话，或直接开始新的提问。'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {config.model ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {config.model}
              </Badge>
            ) : null}

            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" />
              高级设置
            </Button>
          </div>
        </header>

        {modelsQuery.isError || promptsQuery.isError ? (
          <div className="border-b border-border bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6">
            模型或 Prompt 选项加载失败。你仍然可以发送消息，但高级设置中的选项可能不完整。
          </div>
        ) : null}

        {!config.model && !modelsQuery.isLoading ? (
          <div className="border-b border-border bg-warning/10 px-4 py-3 text-sm text-warning sm:px-6">
            当前没有可用逻辑模型。请先到 Endpoint 页面创建并启用至少一个 Endpoint。
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <MessageList
            pinnedMessageIds={pinnedMessageIds}
            messages={session.messages}
            onBranchMessage={(message) => void handleBranchMessage(message)}
            onEditMessage={handleEditMessage}
            onStarterPromptSelect={(prompt) => setInputDraft(prompt)}
            onTogglePinMessage={handleTogglePinMessage}
          />

          <InputArea
            value={inputDraft}
            sending={session.sending}
            sendDisabled={sendDisabled}
            onChange={setInputDraft}
            onSend={() => void handleSend()}
          />
        </div>
      </section>

      <AdvancedSettingsDrawer
        availableModels={modelsQuery.data ?? []}
        callInfo={session.lastCallInfo}
        config={config}
        onChange={setConfigField}
        onOpenChange={setSettingsOpen}
        onVariablesChange={setVariables}
        open={settingsOpen}
        promptTemplates={promptsQuery.data ?? []}
      />

      <ConfirmationDialog
        open={pendingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConfirmation(null)
          }
        }}
        title={pendingConfirmation?.title ?? ''}
        description={pendingConfirmation?.description ?? ''}
        confirmLabel={pendingConfirmation?.confirmLabel ?? '确认'}
        tone={pendingConfirmation?.tone ?? 'default'}
        onConfirm={pendingConfirmation?.onConfirm ?? (() => {})}
      />
    </div>
  )
}
