import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  type DialogProps as AriaDialogProps,
} from 'react-aria-components'
import { Button } from './Button'
import { cx } from './cx'

export { DialogTrigger }

interface DialogProps {
  title: string
  children: ReactNode | ((close: () => void) => ReactNode)
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  isWide?: boolean
  // Dialogs with their own footer controls render them inside children.
  role?: AriaDialogProps['role']
}

// Centered modal. Focus is trapped, Esc closes, focus returns to the trigger.
export function Dialog({ title, children, isOpen, onOpenChange, isWide, role }: DialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={role !== 'alertdialog'}
      className="ui-dialog-overlay fixed inset-0 z-[80] grid place-items-center bg-scrim p-4"
    >
      <Modal
        className={cx(
          'ui-dialog-modal max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] overflow-auto rounded-xl border border-edge bg-raised text-ink shadow-dialog',
          isWide && 'w-[min(640px,calc(100vw-32px))]',
        )}
      >
        <AriaDialog role={role} className="grid gap-4 p-4 outline-none sm:p-6">
          {({ close }) => (
            <>
              <Heading slot="title" className="text-h2 font-semibold">{title}</Heading>
              {typeof children === 'function' ? children(close) : children}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 max-sm:[&>*]:flex-1">{children}</div>
}

interface AlertDialogProps {
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  isDanger?: boolean
  cancelLabel?: string
}

// Destructive confirmation. Title is the question, the button repeats the verb, focus starts on Cancel.
export function AlertDialog({ title, body, confirmLabel, onConfirm, isOpen, onOpenChange, isDanger = true, cancelLabel = 'Cancel' }: AlertDialogProps) {
  return (
    <Dialog title={title} isOpen={isOpen} onOpenChange={onOpenChange} role="alertdialog">
      {(close) => (
        <>
          <p className="text-body text-ink-2">{body}</p>
          <DialogFooter>
            <Button autoFocus onPress={close}>{cancelLabel}</Button>
            <Button
              variant={isDanger ? 'danger' : 'primary'}
              onPress={async () => {
                await onConfirm()
                close()
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
