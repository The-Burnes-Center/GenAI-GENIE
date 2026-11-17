import { useRef } from 'react'
import { ArrowsLeftRight, FileText, Image as ImageIcon, Paperclip } from '@phosphor-icons/react'
import { Button, Menu, MenuItem, MenuTrigger } from '../ui'
import { acceptAttribute } from '../../uploads/validation'

interface AttachMenuProps {
  // The selected model(s) can read images. When false the image row is disabled and explained.
  canSeeImages: boolean
  // Why images are off, for example "Mistral Large 3 can't see images."
  imageReason: string
  onFiles: (files: File[]) => void
  // Offered when images are off and a model that can see them exists.
  onSwitchModel?: () => void
  isDisabled?: boolean
}

const DOCUMENT_ACCEPT = acceptAttribute('attachment')
  .split(',')
  .filter((ext) => !['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext))
  .join(',')
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp'

// A menu with two rows, each opening the system file picker. Dropping files anywhere on the chat does the same.
export function AttachMenu({ canSeeImages, imageReason, onFiles, onSwitchModel, isDisabled }: AttachMenuProps) {
  const documentInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  function readInput(input: HTMLInputElement) {
    onFiles(Array.from(input.files ?? []))
    input.value = ''
  }

  return (
    <>
      <MenuTrigger>
        <Button variant="ghost" size="sm" isDisabled={isDisabled} className="gap-1.5! px-2! sm:px-2.5!" aria-label="Attach a file">
          <Paperclip size={20} aria-hidden="true" />
          <span className="max-sm:vh">Attach</span>
        </Button>
        <Menu
          aria-label="Attach"
          placement="top start"
          onAction={(key) => {
            if (key === 'document') documentInput.current?.click()
            else if (key === 'image') imageInput.current?.click()
            else if (key === 'switch') onSwitchModel?.()
          }}
        >
          <MenuItem id="document" textValue="Upload a document" icon={<FileText size={20} />}>
            Upload a document
            <Hint>PDF, Word, Excel, CSV, HTML, text or Markdown. Up to 4.5 MB each, 5 per message.</Hint>
          </MenuItem>
          <MenuItem id="image" textValue="Upload an image" icon={<ImageIcon size={20} />} isDisabled={!canSeeImages}>
            Upload an image
            <Hint>{canSeeImages ? 'PNG, JPG, GIF or WebP. Up to 3.75 MB each, 20 per message.' : imageReason}</Hint>
          </MenuItem>
          {!canSeeImages && onSwitchModel ? (
            <MenuItem id="switch" textValue="Switch to a model that can see images" icon={<ArrowsLeftRight size={20} />}>
              Switch to a model that can see images
            </MenuItem>
          ) : null}
        </Menu>
      </MenuTrigger>
      <input ref={documentInput} type="file" hidden multiple accept={DOCUMENT_ACCEPT} aria-label="Choose documents" tabIndex={-1} onChange={(event) => readInput(event.currentTarget)} />
      <input ref={imageInput} type="file" hidden multiple accept={IMAGE_ACCEPT} aria-label="Choose images" tabIndex={-1} onChange={(event) => readInput(event.currentTarget)} />
    </>
  )
}

function Hint({ children }: { children: string }) {
  return <span className="block max-w-[300px] whitespace-normal text-caption text-ink-3">{children}</span>
}
