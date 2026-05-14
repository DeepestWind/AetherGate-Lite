import { vi } from 'vitest'
import { PromptPreviewDialog } from '@/features/prompts/components/prompt-preview-dialog'
import { render } from '@/testing/render'

vi.mock('@/features/prompts/mutations/use-preview-prompt-mutation', () => ({
  usePreviewPromptMutation: () => ({
    data: '',
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    reset: vi.fn()
  })
}))

describe('PromptPreviewDialog', () => {
  it('does not enter a render loop while closed', () => {
    expect(() =>
      render(<PromptPreviewDialog open={false} prompt={null} onOpenChange={() => {}} />)
    ).not.toThrow()
  })
})
