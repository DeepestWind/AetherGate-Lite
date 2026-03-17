import { GitBranch, PanelLeftOpen, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/features/chat/chat-types'
import { defaultChatConfig } from '@/features/chat/chat-types'
import { AdvancedSettingsDrawer } from '@/features/chat/components/advanced-settings-drawer'
import { ConversationTreePanel } from '@/features/chat/components/conversation-tree-panel'
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
import { Select } from '@/shared/ui/select'

type PendingConfirmation = {
  confirmLabel: string
  description: string
  onConfirm: () => Promise<void> | void
  title: string
  tone?: 'danger' | 'default'
} | null

const MAX_MESSAGE_LENGTH = 32_768

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
  const desktopChatSidebarVisible = desktopSidebarOpen
  const activeBranchName = session.activeSession?.activeBranch?.name ?? 'main'
  const branchCount = session.activeSession?.branches.length ?? 0
  const pendingEditCount = session.pendingEditCount

  const sendDisabled =
    !inputDraft.trim() || session.sending || !config.model || inputDraft.length > MAX_MESSAGE_LENGTH

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

  const handleEditMessage = async (message: ChatMessage, content: string) => {
    const baselineContent = message.originalContent ?? message.content
    try {
      const mode = await session.commitMessageEdit(message.id, content, config)

      if (mode === 'buffered') {
        toast.success(content === baselineContent ? '已撤销本地修改' : '已加入待提交修改')
        return
      }

      if (mode === 'branch_user') {
        toast.success('已从该用户消息开出新分支，并自动生成回复')
        return
      }

      toast.success('已从该消息开出新分支')
    } catch {
      toast.error('保存修改失败')
    }
  }

  const handleRegenerateMessage = async (message: ChatMessage) => {
    await session.regenerateAssistantMessage(message.id, config)
  }

  const handleSelectAssistantMessage = async (messageId: string) => {
    await session.selectAssistantMessage(messageId)
  }

  const handleBranchMessage = async (message: ChatMessage) => {
    if (session.sending || !session.activeSessionId) {
      return
    }

    await session.createBranch(message.id)
    toast.success('已从当前节点创建新分支')
  }

  const handleSelectBranch = async (branchId: string) => {
    if (
      session.sending ||
      !session.activeSessionId ||
      branchId === session.activeSession?.activeBranchId
    ) {
      return
    }

    await session.selectBranch(branchId)
  }

  const handleTogglePinMessage = async (message: ChatMessage) => {
    try {
      await session.toggleMessagePin(message.id, !message.pinned)
      toast.success(message.pinned ? '已取消标记消息' : '已标记消息')
    } catch {
      toast.error('更新消息标记失败')
    }
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

      <section className="flex min-w-0 flex-1 bg-background">
        <div className="flex min-w-0 flex-1 flex-col">
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-panel px-2 py-1">
                    <GitBranch className="size-3.5" />
                    <span>分支</span>
                    <Select
                      value={session.activeSession?.activeBranchId ?? ''}
                      onChange={(event) => void handleSelectBranch(event.target.value)}
                      className="h-8 min-w-[132px] border-0 bg-transparent px-2 py-0 text-xs shadow-none focus:ring-0"
                      disabled={(session.activeSession?.branches.length ?? 0) <= 1}
                    >
                      {(session.activeSession?.branches ?? []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <span>{branchCount} 条路径已载入</span>
                  <span>当前 {activeBranchName}</span>
                  {pendingEditCount > 0 ? <span>{pendingEditCount} 处修改待提交</span> : null}
                </div>
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
            messages={session.messages}
            messageNodes={session.activeSession?.messageNodes ?? {}}
            onBranchMessage={(message) => void handleBranchMessage(message)}
            onEditMessage={handleEditMessage}
            onRegenerateMessage={(message) => void handleRegenerateMessage(message)}
            onSelectSiblingMessage={(messageId) => void handleSelectAssistantMessage(messageId)}
            onStarterPromptSelect={(prompt) => setInputDraft(prompt)}
            onTogglePinMessage={handleTogglePinMessage}
          />

          <InputArea
            value={inputDraft}
            sending={session.sending}
            sendDisabled={sendDisabled}
            onChange={setInputDraft}
            onSend={() => void handleSend()}
            onStop={() => void session.stopChat()}
          />
        </div>
        </div>

        <ConversationTreePanel
          activeBranchId={session.activeSession?.activeBranchId ?? null}
          branches={session.activeSession?.branches ?? []}
          messageNodes={session.activeSession?.messageNodes ?? {}}
          onSelectBranch={(branchId) => void handleSelectBranch(branchId)}
        />
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
