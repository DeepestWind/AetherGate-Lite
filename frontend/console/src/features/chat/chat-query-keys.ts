export const chatQueryKeys = {
  all: ['chat'] as const,
  models: () => [...chatQueryKeys.all, 'models'] as const,
  prompts: () => [...chatQueryKeys.all, 'prompts'] as const
}
