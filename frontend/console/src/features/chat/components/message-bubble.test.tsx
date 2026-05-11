import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatMessage } from '@/features/chat/chat-types'
import { MessageBubble } from '@/features/chat/components/message-bubble'
import { render } from '@/testing/render'

function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? 'msg_1',
    role: overrides.role ?? 'assistant',
    content: overrides.content ?? '这是一次回答',
    timestamp: overrides.timestamp ?? Date.now(),
    status: overrides.status ?? 'completed',
    loading: overrides.loading ?? false,
    originalContent: overrides.originalContent ?? null,
    parentId: overrides.parentId ?? null,
    pendingEdit: overrides.pendingEdit ?? false,
    modifiedFrom: overrides.modifiedFrom ?? null,
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    stale: overrides.stale ?? false,
    errorMessage: overrides.errorMessage ?? null,
    callInfo: overrides.callInfo ?? {
      requestId: 'req_1',
      provider: 'openai',
      model: 'gpt-5.4',
      routeReason: 'balanced',
      cacheHit: false,
      endpointId: 'endpoint_1',
      fallbackCount: 0,
      latencyMs: 824,
      promptTokens: 120,
      completionTokens: 248,
      totalTokens: 368,
      costUsd: 0.0123,
      strategy: 'balanced',
      status: 'success'
    }
  }
}

describe('MessageBubble', () => {
  it('copies content, branches, edits and toggles assistant call details', async () => {
    const user = userEvent.setup()
    const message = buildMessage()
    const onBranchMessage = vi.fn()
    const onEditMessage = vi.fn()
    const onRegenerateMessage = vi.fn()
    const onSelectSiblingMessage = vi.fn()
    const onTogglePinMessage = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    render(
      <MessageBubble
        message={message}
        nextSiblingId="msg_2b"
        onBranchMessage={onBranchMessage}
        onEditMessage={onEditMessage}
        onRegenerateMessage={onRegenerateMessage}
        onSelectSiblingMessage={onSelectSiblingMessage}
        onTogglePinMessage={onTogglePinMessage}
        previousSiblingId={null}
        siblingCount={2}
        siblingIndex={0}
      />
    )

    expect(screen.queryByText('原始调用详情')).not.toBeInTheDocument()

    await user.click(screen.getByText('这是一次回答'))
    expect(screen.queryByText('原始调用详情')).not.toBeInTheDocument()

    await user.click(screen.getByText('调用详情'))

    expect(screen.getByText('原始调用详情')).toBeInTheDocument()
    expect(screen.getByText('请求 ID')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '复制消息' }))
    expect(writeText).toHaveBeenCalledWith('这是一次回答')

    await user.click(screen.getByRole('button', { name: '标记消息' }))
    expect(onTogglePinMessage).toHaveBeenCalledWith(message)

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一条回复' }))
    expect(onSelectSiblingMessage).toHaveBeenCalledWith('msg_2b')

    await user.click(screen.getByRole('button', { name: '重新生成回复' }))
    expect(onRegenerateMessage).toHaveBeenCalledWith(message)

    await user.click(screen.getByRole('button', { name: '从这里分叉' }))
    expect(onBranchMessage).toHaveBeenCalledWith(message)

    await user.click(screen.getByRole('button', { name: '编辑消息' }))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '改写后的内容')
    await user.click(screen.getByRole('button', { name: '保存修改' }))
    expect(onEditMessage).toHaveBeenCalledWith(message, '改写后的内容')
  })

  it('does not show the branch button for user messages', () => {
    const message = buildMessage({
      role: 'user',
      callInfo: null,
      content: '这是用户消息'
    })

    render(
      <MessageBubble
        message={message}
        nextSiblingId={null}
        onBranchMessage={vi.fn()}
        onEditMessage={vi.fn()}
        onRegenerateMessage={vi.fn()}
        onSelectSiblingMessage={vi.fn()}
        onTogglePinMessage={vi.fn()}
        previousSiblingId={null}
        siblingCount={1}
        siblingIndex={0}
      />
    )

    expect(screen.queryByRole('button', { name: '从这里分叉' })).not.toBeInTheDocument()
  })
})
