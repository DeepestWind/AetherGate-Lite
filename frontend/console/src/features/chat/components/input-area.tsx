import { SendHorizontal } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

type InputAreaProps = {
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
  value: string
}

export function InputArea({ onChange, onSend, sending, value }: InputAreaProps) {
  const charCount = value.length

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="border-t border-border bg-panel px-4 py-4">
      <div className="space-y-3 rounded-[24px] border border-border bg-panel-strong p-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder="输入消息，测试 AI 路由和缓存命中... (Enter 发送)"
          className="min-h-[110px] border-0 bg-transparent p-0 focus:border-transparent focus:ring-0"
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Enter 发送 · Shift+Enter 换行</span>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'font-mono text-xs text-muted-foreground',
                charCount > 2000 && 'text-danger'
              )}
            >
              {charCount}/2000
            </span>
            <Button onClick={onSend} disabled={!value.trim() || sending}>
              <SendHorizontal className="size-4" />
              {sending ? '发送中' : '发送'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
