import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import type { ChatSession } from '@/features/chat/chat-types'
import { SessionSidebar } from '@/features/chat/components/session-sidebar'
import { render } from '@/testing/render'

function buildSession(overrides: Partial<ChatSession>): ChatSession {
  return {
    id: overrides.id ?? 'conv_1',
    title: overrides.title ?? '会话标题',
    draftConfig: overrides.draftConfig ?? {
      model: 'gpt-lite',
      promptId: '',
      strategy: 'balanced',
      temperature: 0,
      variables: {}
    },
    lastMessageAt: overrides.lastMessageAt ?? Date.now(),
    lastMessagePreview: overrides.lastMessagePreview ?? '最近一条消息',
    lastMessageRole: overrides.lastMessageRole ?? 'assistant',
    messageCount: overrides.messageCount ?? 2,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    messages: overrides.messages ?? [],
    messagesLoaded: overrides.messagesLoaded ?? true,
    lastCallInfo: overrides.lastCallInfo ?? null
  }
}

describe('SessionSidebar', () => {
  it('groups sessions by recency and filters by search query', async () => {
    const user = userEvent.setup()

    render(
      <SessionSidebar
        activeSessionId="today"
        onCreate={() => {}}
        onDelete={() => {}}
        onRename={async () => {}}
        onSelect={() => {}}
        sending={false}
        sessions={[
          buildSession({
            id: 'today',
            title: '今日会话',
            updatedAt: dayjs().subtract(1, 'hour').valueOf()
          }),
          buildSession({
            id: 'recent',
            title: '本周会话',
            updatedAt: dayjs().subtract(3, 'day').valueOf()
          }),
          buildSession({
            id: 'earlier',
            title: '更早会话',
            updatedAt: dayjs().subtract(12, 'day').valueOf()
          })
        ]}
      />
    )

    expect(screen.getByText('今天')).toBeInTheDocument()
    expect(screen.getByText('最近 7 天')).toBeInTheDocument()
    expect(screen.getByText('更早')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('搜索会话'), '更早')

    await waitFor(() => {
      expect(screen.getByText('更早会话')).toBeInTheDocument()
    })

    expect(screen.queryByText('今日会话')).not.toBeInTheDocument()
    expect(screen.queryByText('本周会话')).not.toBeInTheDocument()
  })

  it('supports inline rename', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)

    render(
      <SessionSidebar
        activeSessionId="today"
        onCreate={() => {}}
        onDelete={() => {}}
        onRename={onRename}
        onSelect={() => {}}
        sending={false}
        sessions={[
          buildSession({
            id: 'today',
            title: '今日会话',
            updatedAt: dayjs().valueOf()
          })
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: '重命名 今日会话' }))

    const input = screen.getByDisplayValue('今日会话')
    await user.clear(input)
    await user.type(input, '新的标题')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('today', '新的标题')
    })
  })
})
