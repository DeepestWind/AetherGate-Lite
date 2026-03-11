export type PromptTemplateRecord = {
  content: string
  createdAt: string
  description: string
  id: number
  isActive: boolean
  name: string
  promptId: string
  updatedAt: string
  useCount: number
  variables: string[]
}

export type PromptFormValues = {
  content: string
  description: string
  isActive: boolean
  name: string
  promptId: string
  variablesText: string
}

