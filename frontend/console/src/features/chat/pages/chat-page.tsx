import { PanelLeft, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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

  const handleSelectSession = (sessionId: string) => {
    void session.selectSession(sessionId)
    setMobileSidebarOpen(false)
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

  const handleRenameSession = async (sessionId: string, title: string) => {
    await session.renameSession(sessionId, title)
  }

  const handleSidebarToggle = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((current) => !current)
      return
    }

    setDesktopSidebarOpen((current) => !current)
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
          'fixed bottom-0 left-0 top-[61px] z-30 max-w-[calc(100vw-32px)] border-r border-border bg-[#fcfcfb] transition-[transform,width,border-color] duration-200 ease-out lg:static lg:top-0 lg:z-0 lg:h-full lg:max-w-none',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          desktopSidebarOpen ? 'w-[280px]' : 'lg:w-0 lg:border-r-0'
        )}
      >
        <div className="h-full w-[280px] max-w-[calc(100vw-32px)] overflow-hidden">
          <SessionSidebar
            activeSessionId={session.activeSessionId}
            onCreate={() => void handleCreateSession()}
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
                onClick={handleSidebarToggle}
                aria-label={desktopSidebarOpen || mobileSidebarOpen ? '收起会话栏' : '展开会话栏'}
              >
                <PanelLeft className="size-4" />
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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={!session.messages.length}
            >
              <Trash2 className="size-4" />
              清空会话
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
            messages={session.messages}
            onStarterPromptSelect={(prompt) => setInputDraft(prompt)}
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
    </div>
  )
}
