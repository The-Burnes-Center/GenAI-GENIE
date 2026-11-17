import type { UiMessage } from '../../chat/messages'
import { classifyFile } from '../../uploads/validation'
import { FileChipList, type FileChipData } from './FileChips'

function toChips(message: UiMessage): FileChipData[] {
  return message.attachments.map((file) => ({
    id: file.key,
    name: file.name,
    size: file.size,
    isImage: classifyFile(file.name) === 'image',
  }))
}

// The person's own message: a quiet sunken bubble on the right, with its files underneath.
export function UserTurn({ message }: { message: UiMessage }) {
  return (
    <article aria-label="Your message" className="mb-7 grid animate-view justify-items-end gap-2">
      <div className="max-w-[min(85%,560px)] whitespace-pre-wrap rounded-lg bg-sunken px-3.5 py-2.5 text-body [overflow-wrap:anywhere]">
        {message.content}
      </div>
      <FileChipList files={toChips(message)} label="Attached files" align="end" />
    </article>
  )
}
