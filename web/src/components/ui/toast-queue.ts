import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components'

export interface ToastContentValue {
  message: string
  tone?: 'info' | 'bad'
  actionLabel?: string
  onAction?: () => void
}

const SUCCESS_TIMEOUT_MS = 6000

// One queue for the whole app. Call toast.show('Chat deleted.') from anywhere.
export const queue = new ToastQueue<ToastContentValue>({ maxVisibleToasts: 3 })

export const toast = {
  show(message: string, options: Omit<ToastContentValue, 'message'> = {}): string {
    // Errors persist until dismissed. Others close after 6 s and pause on hover and focus.
    const timeout = options.tone === 'bad' ? undefined : SUCCESS_TIMEOUT_MS
    return queue.add({ message, ...options }, { timeout })
  },
  error(message: string): string {
    return toast.show(message, { tone: 'bad' })
  },
  close(key: string): void {
    queue.close(key)
  },
}
