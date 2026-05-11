import { GitBranch, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage, TreeNode } from '@/features/chat/chat-types'
import { defaultChatConfig } from '@/features/chat/chat-types'
import { buildTreeView } from '@/features/chat/chat-adapters'
import { AdvancedSettingsDrawer } from '@/features/chat/components/advanced-settings-drawer'
import { CollapseRail } from '@/features/chat/components/collapse-rail'
import { ControlPanel } from '@/features/chat/components/control-panel'
import { InputArea } from '@/features/chat/components/input-area'
import { MarginaliaPanel } from '@/features/chat/components/marginalia-panel'
import { MessageList } from '@/features/chat/components/message-list'
import { SessionSidebar } from '@/features/chat/components/session-sidebar'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import { useChatModelsQuery } from '@/features/chat/queries/use-chat-models-query'
import { useChatPromptsQuery } from '@/features/chat/queries/use-chat-prompts-query'
import { useChatUiStore } from '@/features/chat/stores/use-chat-ui-store'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null)
  const [staleBanner, setStaleBanner] = useState<{ targetId: string } | null>(null)
  const saveDraftConfigRef = useRef(session.saveDraftConfig)
  const lastSyncedSessionIdRef = useRef<string | null>(null)

  const leftCollapsed = useConsoleUiStore((s) => s.chatLeftCollapsed)
  const rightCollapsed = useConsoleUiStore((s) => s.chatRightCollapsed)
  const toggleLeft = useConsoleUiStore((s) => s.toggleChatLeft)
  const toggleRight = useConsoleUiStore((s) => s.toggleChatRight)

  // Responsive auto-collapse
  useEffect(() => {
    const setLeft = useConsoleUiStore.getState().setChatLeftCollapsed
    const setRight = useConsoleUiStore.getState().setChatRightCollapsed
    function handleResize() {
      const width = window.innerWidth
      if (width < 768) {
        setLeft(true)
        setRight(true)
      } else if (width < 1024) {
        setRight(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const tree = useMemo(
    () =>
      buildTreeView({
        messageNodes: session.activeSession?.messageNodes ?? {},
        visibleMessages: session.messages,
        activeBranchHeadId: session.activeSession?.activeBranch?.headMessageId ?? null
      }),
    [session.activeSession?.messageNodes, session.messages, session.activeSession?.activeBranch?.headMessageId]
  )

  const pinnedMessages = useMemo(() => {
    const nodes = session.activeSession?.messageNodes ?? {}
    return Object.values(nodes).filter((node) => node.pinned)
  }, [session.activeSession?.messageNodes])

  const [focusedId, setFocusedId] = useState<string | null>(null)

  useEffect(() => {
    const root = document.querySelector('[data-chat-message-list]')
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
  }, [session.messages.length])

  function handleNodeClick(node: TreeNode) {
    if (node.kind === 'summary') return
    if (node.state === 'stale') {
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
  }

  const handleSelectSession = (sessionId: string) => {
    void session.selectSession(sessionId)
  }

  const handleDeleteSession = (sessionId: string) => {
    const targetSession = session.sessions.find((item) => item.id === sessionId)

    setPendingConfirmation({
      confirmLabel: '删除会话',
      description: `会话"${targetSession?.title ?? '未命名会话'}"及其中的消息会被永久删除，且无法恢复。`,
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
    <div className="h-full flex bg-paper">
      {/* Left column */}
      {leftCollapsed ? (
        <CollapseRail side="left" onToggle={toggleLeft} />
      ) : (
        <aside
          className="bg-paper-warm border-r border-rule flex flex-col shrink-0"
          style={{ width: 220 }}
        >
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
          <ControlPanel
            availableModels={modelsQuery.data ?? []}
            callInfo={session.lastCallInfo}
            config={config}
            onChange={setConfigField}
            onVariablesChange={setVariables}
            promptTemplates={promptsQuery.data ?? []}
          />
        </aside>
      )}

      {/* Middle column — main reading area + input */}
      <main className="flex-1 flex flex-col min-w-0 bg-paper">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/96 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
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

        {staleBanner ? (
          <div className="bg-terracotta/10 border-b border-terracotta/30 px-9 py-2 text-xs text-terracotta flex items-center justify-between">
            <span>此节点已失效。当前 branch head 在另一处。</span>
            <button
              type="button"
              onClick={() => {
                setStaleBanner(null)
                const headId = session.activeSession?.activeBranch?.headMessageId
                if (headId) {
                  const element = document.querySelector(`[data-message-id="${headId}"]`)
                  if (element instanceof HTMLElement) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }
              }}
              className="underline hover:opacity-80"
            >
              跳转
            </button>
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
      </main>

      {/* Right column — tree panel */}
      {rightCollapsed ? (
        <CollapseRail side="right" onToggle={toggleRight} />
      ) : (
        <aside
          className="bg-paper-warm border-l border-rule flex flex-col shrink-0"
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
