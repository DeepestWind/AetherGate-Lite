export const promptQueryKeys = {
  all: ['prompts'] as const,
  list: () => [...promptQueryKeys.all, 'list'] as const
}

