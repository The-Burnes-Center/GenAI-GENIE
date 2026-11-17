import { useRef, useState } from 'react'
import { UploadSimple } from '@phosphor-icons/react'
import { acceptAttribute } from '../../uploads/validation'
import { Button, cx } from '../ui'

// Drag-and-drop target. The Choose files button is the keyboard and touch path to the same handler.
export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      role="group"
      aria-label="Add documents"
      onDragEnter={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsOver(false)
        onFiles(Array.from(event.dataTransfer.files))
      }}
      className={cx(
        'grid justify-items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-center transition-colors duration-[var(--duration-fast)]',
        isOver ? 'border-solid border-accent bg-accent-soft' : 'border-edge-strong bg-surface',
      )}
    >
      <UploadSimple size={28} className="text-accent" aria-hidden="true" />
      <span className="font-medium">Drag files here, or</span>
      <Button onPress={() => inputRef.current?.click()}>Choose files</Button>
      <span className="text-small text-ink-3">PDF, Word, Excel, CSV, HTML, text or Markdown. Up to 50 MB each.</span>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        data-testid="document-input"
        accept={acceptAttribute('workspace')}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
    </div>
  )
}
