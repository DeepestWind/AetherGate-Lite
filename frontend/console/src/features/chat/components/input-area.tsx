import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

type InputAreaProps = {
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  sendDisabled: boolean
  sending: boolean
  value: string
}

const MAX_MESSAGE_LENGTH = 32_768
const WARNING_THRESHOLD = 28_000

export function InputArea({
  onChange,
  onSend,
  onStop,
  sendDisabled,
  sending,
  value
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const charCount = value.length
  const showCharCount = focused || charCount >= WARNING_THRESHOLD

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (sending) {
        onStop()
        return
      }
      if (!sendDisabled) {
        onSend()
      }
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
    <div className="border-t border-rule bg-paper-warm px-9 py-3.5">
      {sending ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 text-xs text-ink-faint italic font-serif">
            — 生成中 —
          </div>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sand text-sand hover:bg-sand/5 text-xs transition"
          >
            ⏹ 停止生成
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            ref={textareaRef}
            data-chat-composer
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="给 Branchat 发送消息"
            className="min-h-[40px] max-h-[240px] resize-none overflow-y-auto"
            rows={1}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="min-h-4 text-xs text-ink-faint">
              {focused || !value ? 'Enter 发送 · Shift+Enter 换行' : null}
            </div>

            <div className="flex items-center gap-3">
              {showCharCount ? (
                <span
                  className={cn(
                    'font-mono text-xs text-ink-faint',
                    charCount > WARNING_THRESHOLD && 'text-warning',
                    charCount > MAX_MESSAGE_LENGTH && 'text-danger'
                  )}
                >
                  {charCount}/{MAX_MESSAGE_LENGTH}
                </span>
              ) : null}

              <Button size="sm" onClick={onSend} disabled={sendDisabled}>
                ↵ 发送
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
