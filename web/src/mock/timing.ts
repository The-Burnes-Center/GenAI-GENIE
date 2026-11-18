// Delays that make the mock feel like the network. Tests set them to zero.
export const mockTiming = {
  authDelayMs: [300, 600] as [number, number],
  firstEventMs: 350,
  tokenDelayMs: 18,
  thinkingDelayMs: 40,
  assistDelayMs: 700,
}

export function randomInRange([low, high]: [number, number]): number {
  return low + Math.round(Math.random() * (high - low))
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
