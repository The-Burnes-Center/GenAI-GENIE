// A small tokenizer so code reads with color without shipping a highlighter: strings, numbers, comments,
// function names and a few common keywords. Good enough for formulas and short snippets.
export type TokenKind = 'string' | 'number' | 'comment' | 'keyword' | 'plain'

export interface CodeToken {
  kind: TokenKind
  text: string
}

const KEYWORDS = 'const|let|var|function|return|if|else|for|while|import|from|export|class|def|in|not|and|or|true|false|null|None|True|False|select|from|where|group|by|order|insert|update|delete'
const TOKEN = new RegExp(
  [
    '(?<comment>//[^\\n]*|#[^\\n]*|--[^\\n]*)',
    '(?<string>"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')',
    '(?<number>\\b\\d+(?:\\.\\d+)?\\b)',
    '(?<keyword>\\b(?:[A-Z][A-Z0-9.]+(?=\\()|(?:' + KEYWORDS + ')\\b))',
  ].join('|'),
  'g',
)

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let last = 0
  for (const match of code.matchAll(TOKEN)) {
    const start = match.index ?? 0
    if (start > last) tokens.push({ kind: 'plain', text: code.slice(last, start) })
    const kind = (Object.entries(match.groups ?? {}).find(([, value]) => value !== undefined)?.[0] ?? 'plain') as TokenKind
    tokens.push({ kind, text: match[0] })
    last = start + match[0].length
  }
  if (last < code.length) tokens.push({ kind: 'plain', text: code.slice(last) })
  return tokens
}
