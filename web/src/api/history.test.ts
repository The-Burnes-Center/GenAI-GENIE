import { describe, expect, it, vi } from 'vitest'
import { deleteAllChats, type DeleteBatchResult } from './history'

function batches(...results: DeleteBatchResult[]) {
  const queue = [...results]
  return vi.fn(async () => queue.shift() ?? { deleted: 0, remaining: 0 })
}

describe('deleteAllChats', () => {
  it('loops until nothing remains and reports running totals', async () => {
    const callOnce = batches({ deleted: 20, remaining: 25 }, { deleted: 20, remaining: 5 }, { deleted: 5, remaining: 0 })
    const progress: number[] = []
    const total = await deleteAllChats(callOnce, (n) => progress.push(n))
    expect(total).toBe(45)
    expect(callOnce).toHaveBeenCalledTimes(3)
    expect(progress).toEqual([20, 40, 45])
  })

  it('stops after one call when remaining is 0', async () => {
    const callOnce = batches({ deleted: 3, remaining: 0 })
    expect(await deleteAllChats(callOnce, () => undefined)).toBe(3)
    expect(callOnce).toHaveBeenCalledTimes(1)
  })

  it('gives up when the server keeps reporting remaining chats', async () => {
    const callOnce = vi.fn(async () => ({ deleted: 0, remaining: 9 }))
    await expect(deleteAllChats(callOnce, () => undefined, 4)).rejects.toThrow('Some chats could not be deleted')
    expect(callOnce).toHaveBeenCalledTimes(4)
  })

  it('passes a failure through after the batches that worked', async () => {
    const callOnce = vi
      .fn<() => Promise<DeleteBatchResult>>()
      .mockResolvedValueOnce({ deleted: 20, remaining: 10 })
      .mockRejectedValueOnce(new Error('offline'))
    const progress: number[] = []
    await expect(deleteAllChats(callOnce, (n) => progress.push(n))).rejects.toThrow('offline')
    expect(progress).toEqual([20])
  })
})
