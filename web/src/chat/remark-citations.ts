// Turns [1] style markers in answer text into links to #cite-1 so the renderer can show numbered chips.
// Only numbers that match a real source are touched, and code, links and headings' code are left alone.
interface MdNode {
  type: string
  value?: string
  url?: string
  children?: MdNode[]
}

const MARKER = /\[(\d{1,3})\]/g
const SKIPPED = new Set(['code', 'inlineCode', 'link', 'linkReference', 'definition'])

export const CITE_PREFIX = '#cite-'

export function citeHref(index: number): string {
  return `${CITE_PREFIX}${index}`
}

export function citeIndexFromHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITE_PREFIX)) return null
  const index = Number(href.slice(CITE_PREFIX.length))
  return Number.isInteger(index) ? index : null
}

function splitText(value: string, validIndexes: Set<number>): MdNode[] | null {
  const pieces: MdNode[] = []
  let last = 0
  for (const match of value.matchAll(MARKER)) {
    const index = Number(match[1])
    if (!validIndexes.has(index) || match.index === undefined) continue
    if (match.index > last) pieces.push({ type: 'text', value: value.slice(last, match.index) })
    pieces.push({ type: 'link', url: citeHref(index), children: [{ type: 'text', value: String(index) }] })
    last = match.index + match[0].length
  }
  if (pieces.length === 0) return null
  if (last < value.length) pieces.push({ type: 'text', value: value.slice(last) })
  return pieces
}

function walk(node: MdNode, validIndexes: Set<number>): void {
  if (!node.children || SKIPPED.has(node.type)) return
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && child.value) return splitText(child.value, validIndexes) ?? [child]
    walk(child, validIndexes)
    return [child]
  })
}

// A remark plugin factory. Pass the source numbers the message actually has.
export function remarkCitations(indexes: number[]) {
  const valid = new Set(indexes)
  return () => (tree: MdNode) => {
    if (valid.size > 0) walk(tree, valid)
  }
}
