import { Check, ChevronLeft, MessageSquarePlus, PencilLine, Search, Trash2, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  filterChatSessions,
  formatSessionTime,
  getSessionPreview,
  groupChatSessions
} from '@/features/chat/chat-page-utils'
import type { ChatSession } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

type SessionSidebarProps = {
  activeSessionId: string | null
  onCreate: () => void
  onDelete: (sessionId: string) => void
  onRename: (sessionId: string, title: string) => Promise<void>
  onSelect: (sessionId: string) => void
  sending: boolean
  sessions: ChatSession[]
}

export function SessionSidebar({
  activeSessionId,
  onCreate,
  onDelete,
  onRename,
  onSelect,
  sending,
  sessions
}: SessionSidebarProps) {
  const setChatLeftCollapsed = useConsoleUiStore((s) => s.setChatLeftCollapsed)
  const [query, setQuery] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    if (editingSessionId && !sessions.some((session) => session.id === editingSessionId)) {
      setEditingSessionId(null)
      setDraftTitle('')
    }
  }, [editingSessionId, sessions])

  const groupedSessions = useMemo(() => {
    const filtered = filterChatSessions(sessions, deferredQuery)
    return groupChatSessions(filtered)
  }, [deferredQuery, sessions])

  function startRename(session: ChatSession) {
    setEditingSessionId(session.id)
    setDraftTitle(session.title)
  }

  async function submitRename() {
    if (!editingSessionId) {
      return
    }

    const trimmedTitle = draftTitle.trim()
    if (!trimmedTitle) {
      return
    }

    setSavingSessionId(editingSessionId)
    try {
      await onRename(editingSessionId, trimmedTitle)
      setEditingSessionId(null)
      setDraftTitle('')
    } finally {
      setSavingSessionId(null)
    }
  }

  function cancelRename() {
    setEditingSessionId(null)
    setDraftTitle('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper-warm">
      <div className="px-3.5 pt-3 pb-2 border-b border-rule-soft flex items-center justify-between">
        <span className="font-serif italic text-xs text-ink-soft">对话</span>
        <button
          type="button"
          onClick={() => setChatLeftCollapsed(true)}
          className="text-ink-faint hover:text-ink"
          aria-label="收起对话栏"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <div className="border-b border-rule-soft px-3 py-2">
        <Button className="w-full justify-start" size="sm" onClick={onCreate} disabled={sending}>
          <MessageSquarePlus className="size-3.5" />
          新建对话
        </Button>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话"
            className="pl-9 text-xs h-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groupedSessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule px-3 py-4 text-xs text-ink-faint font-serif italic">
            {query.trim() ? '没有找到匹配的会话。' : '还没有可展示的会话。'}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedSessions.map((group) => (
              <section key={group.label}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {group.label}
                </div>

                <div>
                  {group.sessions.map((session) => {
                    const active = session.id === activeSessionId
                    const editing = session.id === editingSessionId
                    const busy = savingSessionId === session.id

                    return (
                      <div
                        key={session.id}
                        className={cn(
                          'group relative transition-colors',
                          active && 'bg-paper',
                          !active && 'hover:bg-paper-warm'
                        )}
                      >
                        {editing ? (
                          <div className="space-y-2 px-3 py-2">
                            <Input
                              value={draftTitle}
                              onChange={(event) => setDraftTitle(event.target.value)}
                              autoFocus
                              maxLength={200}
                              className="text-xs h-7"
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void submitRename()
                                }

                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelRename()
                                }
                              }}
                            />

                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={cancelRename}
                                disabled={busy}
                              >
                                <X className="size-3" />
                                取消
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void submitRename()}
                                disabled={!draftTitle.trim() || busy}
                              >
                                <Check className="size-3" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onSelect(session.id)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-md mb-0.5 transition-colors',
                                'text-sm text-ink-soft hover:bg-paper-warm',
                                active && 'bg-paper text-ink border-l-2 border-sand pl-[10px]'
                              )}
                            >
                              <div className="truncate text-[13px] leading-snug">
                                {session.title}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="truncate text-[11px] text-ink-faint">
                                  {getSessionPreview(session.lastMessagePreview)}
                                </span>
                                <span className="shrink-0 text-[10px] text-ink-faint">
                                  {formatSessionTime(session.updatedAt)}
                                </span>
                              </div>
                            </button>

                            <div
                              className={cn(
                                'absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-paper-warm/90 p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100',
                                active && 'opacity-100'
                              )}
                            >
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded text-ink-faint transition hover:bg-paper hover:text-ink"
                                aria-label={`重命名 ${session.title}`}
                                onClick={() => startRename(session)}
                                disabled={sending}
                              >
                                <PencilLine className="size-3" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded text-ink-faint transition hover:bg-paper hover:text-danger"
                                aria-label={`删除 ${session.title}`}
                                onClick={() => onDelete(session.id)}
                                disabled={sending}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
