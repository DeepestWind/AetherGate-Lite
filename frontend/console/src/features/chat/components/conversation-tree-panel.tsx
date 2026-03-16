import { GitBranch } from 'lucide-react'
import { useMemo } from 'react'
import type { ChatBranch, ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type ConversationTreePanelProps = {
  activeBranchId: string | null
  branches: ChatBranch[]
  messageNodes: Record<string, ChatMessage>
  onSelectBranch: (branchId: string) => void | Promise<void>
}

type TreeNodeRecord = {
  children: TreeNodeRecord[]
  message: ChatMessage
}

function buildConversationTree(messageNodes: Record<string, ChatMessage>) {
  const visibleNodes = Object.values(messageNodes).filter((message) => !message.archived)
  const byId = new Map(visibleNodes.map((message) => [message.id, message]))
  const childrenByParent = new Map<string | null, ChatMessage[]>()

  for (const message of visibleNodes) {
    const parentId =
      message.parentId && byId.has(message.parentId) ? message.parentId : null
    const siblings = childrenByParent.get(parentId)
    if (siblings) {
      siblings.push(message)
      continue
    }
    childrenByParent.set(parentId, [message])
  }

  const sortMessages = (messages: ChatMessage[]) =>
    [...messages].sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp
      }
      return left.id.localeCompare(right.id)
    })

  const buildNode = (message: ChatMessage): TreeNodeRecord => ({
    message,
    children: sortMessages(childrenByParent.get(message.id) ?? []).map(buildNode)
  })

  return sortMessages(childrenByParent.get(null) ?? []).map(buildNode)
}

function buildBranchHeadMap(branches: ChatBranch[]) {
  const headMap = new Map<string, ChatBranch[]>()

  for (const branch of branches) {
    if (!branch.headMessageId) {
      continue
    }

    const grouped = headMap.get(branch.headMessageId)
    if (grouped) {
      grouped.push(branch)
      continue
    }

    headMap.set(branch.headMessageId, [branch])
  }

  return headMap
}

function buildActivePathSet(
  messageNodes: Record<string, ChatMessage>,
  branches: ChatBranch[],
  activeBranchId: string | null
) {
  const path = new Set<string>()
  const activeBranch =
    branches.find((branch) => branch.id === activeBranchId) ?? branches[0] ?? null

  let currentId = activeBranch?.headMessageId ?? null
  while (currentId) {
    if (path.has(currentId)) {
      break
    }

    const current = messageNodes[currentId]
    if (!current) {
      break
    }

    path.add(currentId)
    currentId = current.parentId
  }

  return path
}

function previewContent(content: string) {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 52) {
    return normalized || '空消息'
  }

  return `${normalized.slice(0, 52)}…`
}

function roleLabel(role: ChatMessage['role']) {
  return role === 'assistant' ? 'Assistant' : role === 'user' ? 'User' : role
}

function TreeNode({
  activeBranchId,
  activePathIds,
  branchHeads,
  depth,
  node,
  onSelectBranch
}: {
  activeBranchId: string | null
  activePathIds: Set<string>
  branchHeads: Map<string, ChatBranch[]>
  depth: number
  node: TreeNodeRecord
  onSelectBranch: (branchId: string) => void | Promise<void>
}) {
  const headBranches = branchHeads.get(node.message.id) ?? []
  const active = activePathIds.has(node.message.id)

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'rounded-2xl border px-3 py-3 transition',
          active
            ? 'border-accent/40 bg-accent-soft/60'
            : 'border-border bg-panel/80'
        )}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{roleLabel(node.message.role)}</span>
              <span className="tabular-nums">{new Date(node.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mt-1 break-words text-sm leading-6 text-foreground">
              {previewContent(node.message.content)}
            </div>
          </div>

          {active ? <span className="size-2 shrink-0 rounded-full bg-accent" /> : null}
        </div>

        {headBranches.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {headBranches.map((branch) => {
              const selected = branch.id === activeBranchId
              return (
                <button
                  key={branch.id}
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition',
                    selected
                      ? 'border-accent/45 bg-accent text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground'
                  )}
                  onClick={() => void onSelectBranch(branch.id)}
                >
                  <GitBranch className="size-3" />
                  {branch.name}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {node.children.length > 0 ? (
        <div className="space-y-2 border-l border-dashed border-border/80 pl-2">
          {node.children.map((child) => (
            <TreeNode
              key={child.message.id}
              activeBranchId={activeBranchId}
              activePathIds={activePathIds}
              branchHeads={branchHeads}
              depth={depth + 1}
              node={child}
              onSelectBranch={onSelectBranch}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ConversationTreePanel({
  activeBranchId,
  branches,
  messageNodes,
  onSelectBranch
}: ConversationTreePanelProps) {
  const tree = useMemo(() => buildConversationTree(messageNodes), [messageNodes])
  const branchHeads = useMemo(() => buildBranchHeadMap(branches), [branches])
  const activePathIds = useMemo(
    () => buildActivePathSet(messageNodes, branches, activeBranchId),
    [activeBranchId, branches, messageNodes]
  )

  return (
    <aside className="hidden xl:flex xl:w-[320px] xl:shrink-0 xl:flex-col xl:border-l xl:border-border xl:bg-[#fbfaf7]">
      <div className="border-b border-border px-4 py-4">
        <div className="text-sm font-semibold text-foreground">对话树</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {Object.keys(messageNodes).length} 个节点，{branches.length} 条分支
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {tree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            当前还没有可展示的节点树。
          </div>
        ) : (
          <div className="space-y-3">
            {tree.map((node) => (
              <TreeNode
                key={node.message.id}
                activeBranchId={activeBranchId}
                activePathIds={activePathIds}
                branchHeads={branchHeads}
                depth={0}
                node={node}
                onSelectBranch={onSelectBranch}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
