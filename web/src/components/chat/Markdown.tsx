import { isValidElement, memo, useMemo, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { citeIndexFromHref, remarkCitations } from '../../chat/remark-citations'
import type { Citation } from '../../api/types'
import { CodeBlock } from './CodeBlock'
import './prose.css'

interface MarkdownProps {
  text: string
  citations?: Citation[]
  onCite?: (index: number) => void
  isStreaming?: boolean
  isCompact?: boolean
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  return ''
}

// react-markdown hands a code block over as <pre><code class="language-x">. Unwrap it into our block.
function Pre({ children }: ComponentProps<'pre'>) {
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : null
  const language = /language-([\w+-]+)/.exec(code?.props.className ?? '')?.[1] ?? 'text'
  return <CodeBlock language={language} code={textOf(code?.props.children ?? children).replace(/\n$/, '')} />
}

function ScrollTable({ children }: ComponentProps<'table'>) {
  return (
    <div className="table-wrap" tabIndex={0} role="group" aria-label="Table, scrolls sideways">
      <table>{children}</table>
    </div>
  )
}

// Answers render as GFM markdown. [n] markers that match a source become numbered chips.
export const Markdown = memo(function Markdown({ text, citations = [], onCite, isStreaming, isCompact }: MarkdownProps) {
  const sourceCount = citations.length
  const titles = useMemo(() => new Map(citations.map((item) => [item.index, item.title])), [citations])
  const plugins = useMemo(() => [remarkGfm, remarkCitations(Array.from(titles.keys()))], [titles])
  const components = useMemo(
    () => ({
      pre: Pre,
      table: ScrollTable,
      a({ href, children, ...rest }: ComponentProps<'a'>) {
        const index = citeIndexFromHref(href)
        if (index === null) return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>
        return (
          <button type="button" className="cite" aria-label={`Source ${index}: ${titles.get(index) ?? ''}`} onClick={() => onCite?.(index)}>
            {children}
          </button>
        )
      },
    }),
    [titles, onCite],
  )
  return (
    <div className={isCompact ? 'prose compact' : 'prose'} data-streaming={isStreaming ? 'true' : undefined} data-sources={sourceCount}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
