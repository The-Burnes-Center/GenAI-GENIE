import { Copy } from '@phosphor-icons/react'
import { Button } from '../ui'
import { copyText } from '../../chat/copy-text'
import { tokenizeCode, type TokenKind } from '../../chat/highlight-code'

const TOKEN_COLOR: Record<TokenKind, string | undefined> = {
  plain: undefined,
  keyword: 'var(--color-code-keyword)',
  string: 'var(--color-code-string)',
  number: 'var(--color-code-number)',
  comment: 'var(--color-code-comment)',
}

interface CodeBlockProps {
  language: string
  code: string
}

// Language label, a Copy code button, and a focusable scroll region so keyboard users can read long lines.
export function CodeBlock({ language, code }: CodeBlockProps) {
  return (
    <div className="codeblock">
      <header>
        <span>{language}</span>
        <Button variant="ghost" size="sm" onPress={() => void copyText(code, 'Code copied.')}>
          <Copy size={16} aria-hidden="true" />
          Copy code
        </Button>
      </header>
      <pre tabIndex={0} aria-label={`${language} code`}>
        <code>
          {tokenizeCode(code).map((token, index) => (
            <span key={index} style={{ color: TOKEN_COLOR[token.kind] }}>{token.text}</span>
          ))}
        </code>
      </pre>
    </div>
  )
}
