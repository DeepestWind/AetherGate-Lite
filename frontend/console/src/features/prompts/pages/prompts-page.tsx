import { Eye, FileText, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EndpointOverviewCard } from '@/features/endpoints/components/endpoint-overview-card'
import { PromptDialog } from '@/features/prompts/components/prompt-dialog'
import { PromptPreviewDialog } from '@/features/prompts/components/prompt-preview-dialog'
import { useCreatePromptMutation } from '@/features/prompts/mutations/use-create-prompt-mutation'
import { useDeletePromptMutation } from '@/features/prompts/mutations/use-delete-prompt-mutation'
import { useUpdatePromptMutation } from '@/features/prompts/mutations/use-update-prompt-mutation'
import type { PromptFormValues, PromptTemplateRecord } from '@/features/prompts/prompt-types'
import { usePromptsQuery } from '@/features/prompts/queries/use-prompts-query'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page-header'

export function PromptsPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const query = usePromptsQuery()
  const createMutation = useCreatePromptMutation()
  const updateMutation = useUpdatePromptMutation()
  const deleteMutation = useDeletePromptMutation()
  const [keyword, setKeyword] = useState('')
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplateRecord | null>(null)
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<PromptTemplateRecord | null>(null)
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplateRecord | null>(null)

  const prompts = query.data ?? []

  const filteredPrompts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) {
      return prompts
    }

    return prompts.filter((prompt) =>
      [prompt.promptId, prompt.name, prompt.description]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    )
  }, [keyword, prompts])

  const activeCount = prompts.filter((prompt) => prompt.isActive).length
  const totalUseCount = prompts.reduce((sum, prompt) => sum + prompt.useCount, 0)
  const variableCount = prompts.reduce((sum, prompt) => sum + prompt.variables.length, 0)

  const handleSubmit = async (values: PromptFormValues) => {
    if (dialogMode === 'edit' && editingPrompt) {
      await updateMutation.mutateAsync({ id: editingPrompt.id, values })
    } else {
      await createMutation.mutateAsync(values)
    }

    setDialogOpen(false)
    setEditingPrompt(null)
  }

  if (!hasHydrated) {
    return <div className="h-[420px] animate-pulse rounded-[20px] bg-secondary" />
  }

  if (!hasToken) {
    return (
      <AuthRequiredState description="Prompt 管理页需要访问 /api/prompts，请先配置 Bearer Token。" />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompts"
        meta={`${prompts.length} templates · ${activeCount} active`}
        actions={
          <Button
            onClick={() => {
              setDialogMode('create')
              setEditingPrompt(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            新增模板
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EndpointOverviewCard
          title="模板总数"
          value={prompts.length}
          subtitle="当前 Prompt 模板数"
          icon={<FileText className="size-5" />}
        />
        <EndpointOverviewCard
          title="启用中"
          value={activeCount}
          subtitle="当前可被请求引用"
          icon={<Power className="size-5" />}
        />
        <EndpointOverviewCard
          title="总使用次数"
          value={totalUseCount}
          subtitle="累计 use_count"
          icon={<Pencil className="size-5" />}
        />
        <EndpointOverviewCard
          title="变量声明"
          value={variableCount}
          subtitle="所有模板变量总数"
          icon={<Eye className="size-5" />}
        />
      </section>

      <section className="rounded-[20px] border border-border bg-panel p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Input
            className="max-w-xl"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按 Prompt ID、名称或描述筛选"
          />
          <div className="text-sm text-muted-foreground">当前结果 {filteredPrompts.length} 条</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {query.isLoading ? (
          <div className="h-[280px] animate-pulse rounded-[18px] bg-secondary xl:col-span-2" />
        ) : query.isError ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Prompt 列表加载失败</CardTitle>
              <CardDescription>请确认后端的 `/api/prompts` 接口可访问。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => query.refetch()}>重试</Button>
            </CardContent>
          </Card>
        ) : filteredPrompts.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>暂无 Prompt 模板</CardTitle>
              <CardDescription>你可以创建新模板，供聊天页和网关请求直接复用。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => {
                  setDialogMode('create')
                  setEditingPrompt(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                新增模板
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredPrompts.map((prompt) => (
            <Card key={prompt.id}>
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{prompt.name}</CardTitle>
                      <Badge variant={prompt.isActive ? 'accent' : 'outline'}>
                        {prompt.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription className="break-all font-mono text-xs">
                      {prompt.promptId}
                    </CardDescription>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    use_count {prompt.useCount}
                  </div>
                </div>
                <CardDescription>{prompt.description || '暂无描述。'}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-[18px] border border-border bg-panel-strong p-4">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    {prompt.content}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  {prompt.variables.length ? (
                    prompt.variables.map((variable) => (
                      <Badge key={variable} variant="outline">
                        {variable}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">无变量</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewPrompt(prompt)
                    }}
                  >
                    <Eye className="size-4" />
                    预览
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogMode('edit')
                      setEditingPrompt(prompt)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="size-4" />
                    编辑
                  </Button>
                  <Button variant="ghost" onClick={() => setPendingDeletePrompt(prompt)}>
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <PromptDialog
        open={dialogOpen}
        mode={dialogMode}
        prompt={editingPrompt}
        pending={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditingPrompt(null)
          }
        }}
        onSubmit={handleSubmit}
      />

      <PromptPreviewDialog
        open={Boolean(previewPrompt)}
        prompt={previewPrompt}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPreviewPrompt(null)
          }
        }}
      />

      <ConfirmationDialog
        open={pendingDeletePrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeletePrompt(null)
          }
        }}
        title="删除这个 Prompt 模板？"
        description={
          pendingDeletePrompt
            ? `模板“${pendingDeletePrompt.promptId}”会被永久删除，且无法恢复。`
            : ''
        }
        confirmLabel="删除模板"
        tone="danger"
        onConfirm={() =>
          pendingDeletePrompt
            ? deleteMutation.mutateAsync(pendingDeletePrompt.id).then(() => {
                setPendingDeletePrompt(null)
              })
            : undefined
        }
      />
    </div>
  )
}
