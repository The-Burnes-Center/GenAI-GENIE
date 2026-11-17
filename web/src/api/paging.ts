import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query'
import type { Page } from './types'

export type PageFetcher<T> = (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>

export function usePagedQuery<T>(queryKey: QueryKey, fetchPage: PageFetcher<T>) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function flattenPages<T>(data: InfiniteData<Page<T>, unknown> | undefined): T[] {
  return data?.pages.flatMap((page) => page.items) ?? []
}
