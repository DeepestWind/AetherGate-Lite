import { fireEvent, screen } from '@testing-library/react'
import { InputArea } from '@/features/chat/components/input-area'
import { render } from '@/testing/render'

describe('InputArea', () => {
  it('sends on Enter and keeps Shift+Enter for newline', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(
      <InputArea
        value="你好"
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={onSend}
        onStop={onStop}
      />
    )

    const textarea = screen.getByPlaceholderText('给 Branchat 发送消息')

    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('shows stop button while streaming and calls onStop when clicked', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(
      <InputArea
        value="你好"
        sending
        sendDisabled={false}
        onChange={() => {}}
        onSend={onSend}
        onStop={onStop}
      />
    )

    const stopButton = screen.getByRole('button', { name: /停止生成/ })
    fireEvent.click(stopButton)

    expect(onSend).not.toHaveBeenCalled()
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('shows character count only when focused or close to the limit', () => {
    render(
      <InputArea
        value="短消息"
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />
    )

    const textarea = screen.getByPlaceholderText('给 Branchat 发送消息')
    expect(screen.queryByText('3/32768')).not.toBeInTheDocument()

    fireEvent.focus(textarea)
    expect(screen.getByText('3/32768')).toBeInTheDocument()
  })

  it('shows character count automatically near the limit', () => {
    render(
      <InputArea
        value={'x'.repeat(28001)}
        sending={false}
        sendDisabled={false}
        onChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />
    )

    expect(screen.getByText('28001/32768')).toBeInTheDocument()
  })
})
