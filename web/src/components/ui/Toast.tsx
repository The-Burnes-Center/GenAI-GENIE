import { Check, Warning, X } from '@phosphor-icons/react'
import { Button, Text, UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent, UNSTABLE_ToastRegion as ToastRegion } from 'react-aria-components'
import { queue } from './toast-queue'
import { cx } from './cx'

// Mount once near the root. Success toasts are polite status; errors are alerts.
export function ToastHost() {
  return (
    <ToastRegion
      queue={queue}
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] grid justify-items-center gap-2 px-4 lg:justify-items-end lg:px-6 outline-none"
    >
      {({ toast: item }) => {
        const { message, tone, actionLabel, onAction } = item.content
        return (
          <Toast
            toast={item}
            className={cx(
              'ui-toast pointer-events-auto flex max-w-[min(480px,100%)] items-center gap-2.5 rounded-lg py-2.5 pl-3.5 pr-2.5 shadow-pop outline-none',
              'data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus',
              tone === 'bad' ? 'bg-danger-soft-ink text-danger-soft' : 'bg-ink text-canvas',
            )}
          >
            {tone === 'bad' ? <Warning size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            <ToastContent className="min-w-0 flex-1">
              <Text slot="title">{message}</Text>
            </ToastContent>
            {actionLabel && (
              <Button
                onPress={() => {
                  onAction?.()
                  queue.close(item.key)
                }}
                className="min-h-[30px] rounded-md px-2 font-medium underline outline-none data-[hovered]:bg-canvas/20 data-[focus-visible]:outline-2 data-[focus-visible]:outline-canvas"
              >
                {actionLabel}
              </Button>
            )}
            <Button
              slot="close"
              aria-label="Dismiss notification"
              className="grid size-8 place-items-center rounded-md outline-none data-[hovered]:bg-canvas/20 data-[focus-visible]:outline-2 data-[focus-visible]:outline-canvas pointer-coarse:size-11"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </Toast>
        )
      }}
    </ToastRegion>
  )
}
