import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { Spinner } from './Spinner'

interface InfiniteListProps<Item> {
  items: Item[]
  renderItem: (item: Item) => ReactNode
  getKey: (item: Item) => string
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  // Scroll container for the observer. Defaults to the viewport.
  root?: Element | null
  className?: string
}

const PREFETCH_MARGIN = '200px'

// Renders items and loads the next page when the end scrolls near. The "Load more" button is the
// keyboard and no-observer fallback, so paging never depends on scrolling.
export function InfiniteList<Item>({ items, renderItem, getKey, hasNextPage, isFetchingNextPage, fetchNextPage, root, className }: InfiniteListProps<Item>) {
  return (
    <>
      <ul className={className}>
        {items.map((item) => (
          <li key={getKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      <LoadMore hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} fetchNextPage={fetchNextPage} root={root} />
    </>
  )
}

interface LoadMoreProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  root?: Element | null
}

// Sentinel plus button. Use it directly under any list built from a TanStack infinite query.
export function LoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage, root }: LoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  useEffect(() => {
    latest.current = { hasNextPage, isFetchingNextPage, fetchNextPage }
  })

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const state = latest.current
        if (entry?.isIntersecting && state.hasNextPage && !state.isFetchingNextPage) state.fetchNextPage()
      },
      { root: root ?? null, rootMargin: PREFETCH_MARGIN },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [root])

  if (!hasNextPage && !isFetchingNextPage) return null
  return (
    <div ref={sentinelRef} className="flex justify-center py-2">
      <Button variant="ghost" size="sm" onPress={fetchNextPage} isDisabled={isFetchingNextPage}>
        {isFetchingNextPage ? <Spinner label="Loading more" /> : 'Load more'}
      </Button>
    </div>
  )
}
