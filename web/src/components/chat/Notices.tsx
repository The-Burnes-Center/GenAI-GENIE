import { Info } from '@phosphor-icons/react'
import { noticeText } from '../../chat/notice-copy'
import type { UiNotice } from '../../chat/messages'

// Notices are a quiet sunken line with an info icon, never a banner or a toast.
export function Notices({ notices }: { notices: UiNotice[] }) {
  if (notices.length === 0) return null
  return (
    <ul aria-label="Notes about this answer" className="mb-3 grid gap-1.5">
      {notices.map((notice, index) => (
        <li
          key={`${notice.code}-${index}`}
          className="flex max-w-[560px] items-start gap-2 rounded-md bg-sunken px-3 py-2 text-small text-ink-2"
        >
          <Info size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>{noticeText(notice)}</span>
        </li>
      ))}
    </ul>
  )
}
