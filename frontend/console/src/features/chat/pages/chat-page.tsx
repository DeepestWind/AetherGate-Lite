import { Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { ControlPanel } from '@/features/chat/components/control-panel'
import { InputArea } from '@/features/chat/components/input-area'
import { MessageList } from '@/features/chat/components/message-list'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import { useChatModelsQuery } from '@/features/chat/queries/use-chat-models-query'
import { useChatPromptsQuery } from '@/features/chat/queries/use-chat-prompts-query'
import { useChatUiStore } from '@/features/chat/stores/use-chat-ui-store'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export function ChatPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const modelsQuery = useChatModelsQuery()
  const promptsQuery = useChatPromptsQuery()
  const session = useChatSession()
  const { config, inputDraft, setConfigField, setInputDraft, setVariables } = useChatUiStore()

  useEffect(() => {
    if (!config.model && (modelsQuery.data?.length ?? 0) > 0) {
      setConfigField('model', modelsQuery.data?.[0] ?? '')
    }
  }, [config.model, modelsQuery.data, setConfigField])

  const handleSend = async () => {
    const content = inputDraft.trim()
    if (!content || session.sending || !config.model) {
      return
    }

    setInputDraft('')
    await session.sendChat(content, config)
  }

  if (!hasHydrated) {
    return <div className="h-[720px] animate-pulse rounded-[20px] bg-secondary" />
  }

  if (!hasToken) {
    return (
      <AuthRequiredState description="聊天页需要访问 /v1/models、/api/prompts 和 /v1/chat/completions，请先配置 Bearer Token。" />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 xl:flex-row">
      <ControlPanel
        config={config}
        availableModels={modelsQuery.data ?? []}
        promptTemplates={promptsQuery.data ?? []}
        callInfo={session.lastCallInfo}
        onChange={setConfigField}
        onVariablesChange={setVariables}
      />

      <Card className="flex min-h-[720px] min-w-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border py-4">
          <div>
            <CardTitle className="text-lg">对话演示</CardTitle>
            <CardDescription>直接走 `/v1/chat/completions`，保留 header 追踪信息。</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{session.messages.length} 条消息</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('确定清空当前对话吗？该操作不可撤销。')) {
                  session.clearChat()
                }
              }}
            >
              <Trash2 className="size-4" />
              清空
            </Button>
          </div>
        </CardHeader>

        {modelsQuery.isError || promptsQuery.isError ? (
          <div className="border-b border-border bg-warning/10 px-5 py-3 text-sm text-warning">
            模型或 Prompt 选项加载失败。你仍然可以直接发送消息，但下拉选项可能不完整。
          </div>
        ) : null}

        {!config.model && !modelsQuery.isLoading ? (
          <div className="border-b border-border bg-warning/10 px-5 py-3 text-sm text-warning">
            当前没有可用逻辑模型。请先到 Endpoint 页面创建并启用至少一个 Endpoint。
          </div>
        ) : null}

        <MessageList messages={session.messages} />
        <InputArea
          value={inputDraft}
          sending={session.sending || !config.model}
          onChange={setInputDraft}
          onSend={handleSend}
        />
      </Card>
    </div>
  )
}
