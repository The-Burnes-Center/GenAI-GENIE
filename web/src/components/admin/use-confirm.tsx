import { useState, type ReactNode } from 'react'
import { describeError } from '../../api/errors'
import { AlertDialog, toast } from '../ui'

export interface ConfirmSpec {
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  isDanger?: boolean
}

// One confirm dialog per page: call ask(spec) from any button or menu item and render `dialog` once.
// A failed action shows an error toast instead of leaving the dialog open and silent.
export function useConfirm() {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const ask = (next: ConfirmSpec) => {
    setSpec(next)
    setIsOpen(true)
  }

  const dialog = spec ? (
    <AlertDialog
      title={spec.title}
      body={spec.body}
      confirmLabel={spec.confirmLabel}
      isDanger={spec.isDanger}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={async () => {
        try {
          await spec.onConfirm()
        } catch (error) {
          toast.error(describeError(error))
        }
      }}
    />
  ) : null

  return { ask, dialog }
}
