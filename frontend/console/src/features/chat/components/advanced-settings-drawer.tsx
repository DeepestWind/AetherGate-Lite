import type { ChatCallInfo, ChatConfig, PromptTemplate } from '@/features/chat/chat-types'
import { ControlPanel } from '@/features/chat/components/control-panel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'

type AdvancedSettingsDrawerProps = {
  availableModels: string[]
  callInfo: ChatCallInfo | null
  config: ChatConfig
  onChange: <K extends keyof ChatConfig>(key: K, value: ChatConfig[K]) => void
  onOpenChange: (open: boolean) => void
  onVariablesChange: (variables: Record<string, string>) => void
  open: boolean
  promptTemplates: PromptTemplate[]
}

export function AdvancedSettingsDrawer({
  availableModels,
  callInfo,
  config,
  onChange,
  onOpenChange,
  onVariablesChange,
  open,
  promptTemplates
}: AdvancedSettingsDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,440px)] translate-x-0 translate-y-0 rounded-none rounded-l-[28px] border-l border-r-0 border-t-0 p-0 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.24)]">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="text-xl tracking-[-0.03em]">高级设置</DialogTitle>
            <DialogDescription>
              这些参数按会话保存，默认隐藏，只有在需要时才展开调整。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <ControlPanel
              availableModels={availableModels}
              callInfo={callInfo}
              config={config}
              onChange={onChange}
              onVariablesChange={onVariablesChange}
              promptTemplates={promptTemplates}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
