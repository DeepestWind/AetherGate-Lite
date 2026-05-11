import { Button } from '@/shared/ui/button'

type EmptyStateProps = {
  onCreate: () => void
}

export function ChatEmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-9 py-20 text-center">
      <h2 className="font-serif text-2xl text-ink mb-2">还没有任何对话</h2>
      <p className="font-serif italic text-sm text-ink-soft mb-6">
        a tree begins with a single root
      </p>
      <Button onClick={onCreate} className="rounded-full px-6">
        + 开始第一个对话
      </Button>
      <p className="mt-8 text-xs text-ink-faint leading-relaxed max-w-sm">
        Branchat 把每次对话保存为一棵树。你可以从任意 AI 回复开新支线、修改历史回答、
        或在长会话里自动压缩早期内容。
      </p>
    </div>
  )
}
