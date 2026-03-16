import { SendHorizontal } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

type InputAreaProps = {
  onChange: (value: string) => void
  onSend: () => void
  sendDisabled: boolean
  sending: boolean
  value: string
}

export function InputArea({ onChange, onSend, sendDisabled, sending, value }: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const charCount = value.length
  const showCharCount = focused || charCount >= 1600

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  useEffect(() => {
    const element = textareaRef.current
    if (!element) {
      return
    }

    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`
  })

  return (
    <div className="border-t border-border bg-background px-4 pb-5 pt-4 sm:px-6">
      <div className="mx-auto max-w-[820px] rounded-[28px] border border-border bg-panel px-4 py-3 shadow-[0_16px_50px_-40px_rgba(15,23,42,0.25)]">
        <Textarea
          ref={textareaRef}
          data-chat-composer
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="给 Branchat 发送消息"
          className="min-h-[56px] max-h-[240px] resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-[15px] leading-7 focus:border-transparent focus:ring-0"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-h-4 text-xs text-muted-foreground">
            {focused || !value ? 'Enter 发送 · Shift+Enter 换行' : null}
          </div>

          <div className="flex items-center gap-3">
            {showCharCount ? (
              <span
                className={cn(
                  'font-mono text-xs text-muted-foreground',
                  charCount > 1900 && 'text-warning',
                  charCount > 2000 && 'text-danger'
                )}
              >
                {charCount}/2000
              </span>
            ) : null}

            <Button onClick={onSend} disabled={sendDisabled}>
              <SendHorizontal className="size-4" />
              {sending ? '发送中' : '发送'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
