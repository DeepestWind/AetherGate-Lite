import { type ComponentProps, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

type CodeProps = ComponentProps<'code'> & {
  inline?: boolean
}

function CodeBlock({ children, className, inline, ...props }: CodeProps) {
  const [copied, setCopied] = useState(false)
  const code = String(children ?? '').replace(/\n$/, '')

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="branchat-code-block">
      <button
        type="button"
        className="branchat-code-copy"
        onClick={() => void copyText(code).then(() => setCopied(true))}
      >
        {copied ? '已复制' : '复制代码'}
      </button>
      <pre>
        <code className={className} {...props}>
          {code}
        </code>
      </pre>
    </div>
  )
}

type ChatMarkdownProps = {
  content: string
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="branchat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, ...props }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" {...props} />
          ),
          code: CodeBlock,
          table: ({ children, ...props }) => (
            <div className="branchat-table-wrap">
              <table {...props}>{children}</table>
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
