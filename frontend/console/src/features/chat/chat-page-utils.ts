import dayjs from 'dayjs'
import type { ChatSession } from '@/features/chat/chat-types'

export type ChatSessionGroup = {
  label: string
  sessions: ChatSession[]
}

export const chatStarterPrompts = [
  '帮我梳理这个项目的前端优化方向',
  '总结一下最近一次会话的重点',
  '给我一版更简洁的聊天页文案',
  '把这个需求拆成可执行任务'
]

export function formatSessionTime(value: number) {
  if (dayjs(value).isSame(dayjs(), 'day')) {
    return dayjs(value).format('HH:mm')
  }

  return dayjs(value).format('MM-DD')
}

export function getSessionPreview(message: string | null | undefined) {
  if (!message) {
    return '等待第一条消息'
  }

  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 42) {
    return normalized
  }

  return `${normalized.slice(0, 42)}…`
}

export function filterChatSessions(sessions: ChatSession[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return sessions
  }

  return sessions.filter((session) => {
    const target = `${session.title} ${session.lastMessagePreview ?? ''}`.toLowerCase()
    return target.includes(normalizedQuery)
  })
}

export function groupChatSessions(sessions: ChatSession[]): ChatSessionGroup[] {
  const today: ChatSession[] = []
  const recent: ChatSession[] = []
  const earlier: ChatSession[] = []
  const now = dayjs()

  for (const session of sessions) {
    const updatedAt = dayjs(session.updatedAt)

    if (updatedAt.isSame(now, 'day')) {
      today.push(session)
      continue
    }

    if (updatedAt.isAfter(now.subtract(7, 'day'))) {
      recent.push(session)
      continue
    }

    earlier.push(session)
  }

  return [
    { label: '今天', sessions: today },
    { label: '最近 7 天', sessions: recent },
    { label: '更早', sessions: earlier }
  ].filter((group) => group.sessions.length > 0)
}
