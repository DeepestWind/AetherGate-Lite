import { Check, MessageSquarePlus, PencilLine, Search, Trash2, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  filterChatSessions,
  formatSessionTime,
  getSessionPreview,
  groupChatSessions
} from '@/features/chat/chat-page-utils'
import type { ChatSession } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
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
    <div className="flex h-full min-h-0 flex-col bg-[#fcfcfb]">
      <div className="border-b border-border px-4 py-4">
        <Button className="w-full justify-start" onClick={onCreate} disabled={sending}>
          <MessageSquarePlus className="size-4" />
          新建聊天
        </Button>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话"
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {groupedSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {query.trim() ? '没有找到匹配的会话。' : '还没有可展示的会话。'}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedSessions.map((group) => (
              <section key={group.label}>
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </div>

                <div className="mt-2 space-y-1">
                  {group.sessions.map((session) => {
                    const active = session.id === activeSessionId
                    const editing = session.id === editingSessionId
                    const busy = savingSessionId === session.id

                    return (
                      <div
                        key={session.id}
                        className={cn(
                          'group rounded-2xl border border-transparent transition',
                          active && 'bg-secondary',
                          !active && 'hover:bg-secondary/80'
                        )}
                      >
                        {editing ? (
                          <div className="space-y-3 px-3 py-3">
                            <Input
                              value={draftTitle}
                              onChange={(event) => setDraftTitle(event.target.value)}
                              autoFocus
                              maxLength={200}
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

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={cancelRename}
                                disabled={busy}
                              >
                                <X className="size-3.5" />
                                取消
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void submitRename()}
                                disabled={!draftTitle.trim() || busy}
                              >
                                <Check className="size-3.5" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => onSelect(session.id)}
                              className="block w-full rounded-2xl px-3 py-3 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={cn(
                                      'truncate text-[14px] font-medium',
                                      active ? 'text-foreground' : 'text-foreground-soft'
                                    )}
                                  >
                                    {session.title}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-muted-foreground">
                                    {getSessionPreview(session.lastMessagePreview)}
                                  </div>
                                </div>

                                <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                                  {formatSessionTime(session.updatedAt)}
                                </span>
                              </div>
                            </button>

                            <div
                              className={cn(
                                'absolute right-2 top-2 flex items-center gap-1 rounded-xl bg-[#fcfcfb]/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100',
                                active && 'opacity-100'
                              )}
                            >
                              <button
                                type="button"
                                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-panel hover:text-foreground"
                                aria-label={`重命名 ${session.title}`}
                                onClick={() => startRename(session)}
                                disabled={sending}
                              >
                                <PencilLine className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-panel hover:text-danger"
                                aria-label={`删除 ${session.title}`}
                                onClick={() => onDelete(session.id)}
                                disabled={sending}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
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
