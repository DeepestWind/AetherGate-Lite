export const providerOptions = [
  {
    value: 'openai_compatible',
    label: 'openai_compatible',
    description: '兼容 OpenAI 格式（推荐）',
    tag: '推荐'
  },
  {
    value: 'ollama',
    label: 'ollama',
    description: '本地 Ollama，无需 Key'
  }
] as const

export const officialProviderBaseUrls = {
  openai_compatible: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434'
} as const

export const providerTypeFilterOptions = [
  { label: '全部协议', value: '' },
  { label: 'openai_compatible', value: 'openai_compatible' },
  { label: 'ollama', value: 'ollama' }
] as const

export const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '启用中', value: 'enabled' },
  { label: '已禁用', value: 'disabled' },
  { label: '有效', value: 'valid' },
  { label: '无效', value: 'invalid' }
] as const

export const providerColorMap: Record<string, string> = {
  openai_compatible: 'text-accent-strong border-accent-strong/30 bg-accent-strong/10',
  ollama: 'text-accent border-accent/30 bg-accent/10'
}
