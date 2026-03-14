import { fireEvent, screen } from '@testing-library/react'
import { InputArea } from '@/features/chat/components/input-area'
import { render } from '@/testing/render'

describe('InputArea', () => {
  it('sends on Enter and keeps Shift+Enter for newline', () => {
    const onSend = vi.fn()

    render(
      <InputArea
        value="你好"
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={onSend}
      />
    )

    const textarea = screen.getByPlaceholderText('给 AetherGate 发送消息')

    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('shows character count only when focused or close to the limit', () => {
    render(
      <InputArea
        value="短消息"
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={() => {}}
      />
    )

    const textarea = screen.getByPlaceholderText('给 AetherGate 发送消息')
    expect(screen.queryByText('3/2000')).not.toBeInTheDocument()

    fireEvent.focus(textarea)
    expect(screen.getByText('3/2000')).toBeInTheDocument()
  })

  it('shows character count automatically near the limit', () => {
    render(
      <InputArea
        value={'x'.repeat(1700)}
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={() => {}}
      />
    )

    expect(screen.getByText('1700/2000')).toBeInTheDocument()
  })
})
