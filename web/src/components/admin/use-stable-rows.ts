import { useEffect, useRef, useState } from 'react'
import { moveItem } from './list-helpers'

let rowCounter = 0
const newRowId = () => `row-${(rowCounter += 1)}`

type Target = { rowId: string; action: 'up' | 'down' | 'field' } | { add: true }

// Rows in an editable list keep an id of their own, so a row keeps its place (and focus) when others are moved or
// removed. Duplicates are allowed in the values, so the values themselves cannot be keys.
export function useStableRows<T>(value: T[], onChange: (next: T[]) => void, blank: () => T) {
  const [ids, setIds] = useState<string[]>(() => value.map(newRowId))
  const containerRef = useRef<HTMLDivElement>(null)
  const target = useRef<Target | null>(null)

  // After each change, put focus where the person would expect it.
  useEffect(() => {
    const wanted = target.current
    const root = containerRef.current
    target.current = null
    if (!wanted || !root) return
    if ('add' in wanted) {
      root.querySelector<HTMLElement>('[data-add]')?.focus()
      return
    }
    const row = root.querySelector<HTMLElement>(`[data-row-id="${wanted.rowId}"]`)
    const pick = (selector: string) => row?.querySelector<HTMLElement>(`${selector}:not([disabled]):not([aria-disabled="true"])`)
    const button = wanted.action === 'field' ? pick('input, textarea') : (pick(`[data-action="${wanted.action}"]`) ?? pick('[data-action]'))
    button?.focus()
  })

  const rows = value.map((item, index) => ({ item, index, id: ids[index] ?? `extra-${index}` }))

  const api = {
    rows,
    edit: (index: number, item: T) => onChange(value.map((current, at) => (at === index ? item : current))),
    add: () => {
      const id = newRowId()
      setIds([...ids, id])
      onChange([...value, blank()])
      target.current = { rowId: id, action: 'field' }
    },
    move: (from: number, to: number) => {
      setIds(moveItem(ids, from, to))
      onChange(moveItem(value, from, to))
      target.current = { rowId: ids[from] ?? '', action: to < from ? 'up' : 'down' }
    },
    remove: (index: number) => {
      const neighbor = ids[index + 1] ?? ids[index - 1]
      setIds(ids.filter((_, at) => at !== index))
      onChange(value.filter((_, at) => at !== index))
      target.current = neighbor ? { rowId: neighbor, action: 'field' } : { add: true }
    },
  }
  return [api, containerRef] as const
}
