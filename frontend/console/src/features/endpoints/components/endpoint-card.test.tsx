import { screen } from '@testing-library/react'
import { EndpointCard } from '@/features/endpoints/components/endpoint-card'
import type { Endpoint } from '@/features/endpoints/endpoint-types'
import { render } from '@/testing/render'

const endpoint: Endpoint = {
  id: 1,
  name: '官方 GPT5mini',
  providerType: 'openai_compatible',
  baseUrl: 'https://api.openai.com/v1',
  maskedKey: `sk-${'p'.repeat(160)}-tail`,
  modelName: 'GPT-5-mini',
  logicalModel: 'GPT-5-mini',
  priority: 100,
  isEnabled: true,
  isValid: true,
  qualityScore: 8,
  inputCostPer1k: 0,
  outputCostPer1k: 0,
  remark: '',
  createdAt: '2026-03-11T00:00:00Z',
  lastValidatedAt: '2026-03-11T00:00:00Z'
}

describe('EndpointCard', () => {
  it('keeps long api keys constrained inside the detail grid', () => {
    render(
      <EndpointCard
        endpoint={endpoint}
        validating={false}
        onValidate={() => {}}
        onEdit={() => {}}
        onToggleEnabled={() => {}}
        onDelete={() => {}}
      />
    )

    const apiKeyValue = screen.getByText(endpoint.maskedKey)

    expect(apiKeyValue).toHaveClass('min-w-0')
    expect(apiKeyValue).toHaveClass('break-all')
    expect(apiKeyValue).toHaveAttribute('title', endpoint.maskedKey)
    expect(apiKeyValue.closest('div')).toHaveClass('grid-cols-[80px_minmax(0,1fr)]')
  })
})
