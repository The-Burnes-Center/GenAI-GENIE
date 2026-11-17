import type { UiNotice } from './messages'

const HISTORY_TRIMMED = 'Earlier messages were shortened to fit this model’s limit. Genie kept the most recent ones.'
const ATTACHMENT_AS_TEXT = 'This model reads documents as plain text. Tables, layout and pictures in the file may be lost.'
const ATTACHMENT_TRUNCATED = 'Part of a long file was left out to fit this model’s limit.'
const ATTACHMENTS_LIMITED = 'Some older files were sent as text or left out because a message can include only so many files.'
const ATTACHMENT_EXPIRED = 'A file from earlier in this chat is no longer available. Files are kept for 30 days.'
const SAVE_FAILED = 'This answer could not be saved to your history. Copy it now if you need it.'

// Fixed copy for the two notices the design words. The others name files, so the server's text is kept.
const FIXED: Record<string, string> = { HISTORY_TRIMMED, ATTACHMENT_AS_TEXT }
const FALLBACK: Record<string, string> = { ATTACHMENT_TRUNCATED, ATTACHMENTS_LIMITED, ATTACHMENT_EXPIRED, SAVE_FAILED }

export function noticeText(notice: UiNotice): string {
  return FIXED[notice.code] ?? (notice.message.trim() || FALLBACK[notice.code]) ?? notice.message
}
