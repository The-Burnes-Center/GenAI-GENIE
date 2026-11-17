import { Button, Dialog, DialogFooter } from '../../components/ui'

const SHORTCUTS: Array<[string, string]> = [
  ['Enter', 'Send message'],
  ['Shift Enter', 'New line'],
  ['Esc', 'Stop writing, or close a menu'],
  ['Ctrl K', 'Search chats'],
  ['Alt N', 'New chat'],
  ['Alt S', 'Show or hide the sidebar'],
  ['Alt M', 'Choose a model'],
  ['?', 'Show this list'],
]

export function ShortcutsDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }) {
  return (
    <Dialog title="Keyboard shortcuts" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => (
        <>
          <dl className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2.5">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="contents">
                <dd className="order-1">{action}</dd>
                <dt className="order-2 flex gap-1">
                  {keys.split(' ').map((key) => (
                    <kbd key={key} className="rounded-xs border border-edge-strong px-1.5 text-[11px] leading-[18px] text-ink-3">{key}</kbd>
                  ))}
                </dt>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button variant="primary" onPress={close}>Close</Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
