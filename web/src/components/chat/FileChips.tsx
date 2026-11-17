import { FileText, Image as ImageIcon, WarningCircle, X } from '@phosphor-icons/react'
import { formatFileSize } from '../../chat/format-size'
import { IconButton, Spinner, cx } from '../ui'

export interface FileChipData {
  id: string
  name: string
  size: number
  isImage: boolean
  status?: 'uploading' | 'ready' | 'error'
  fraction?: number
  error?: string
}

interface FileChipProps {
  file: FileChipData
  onRemove?: (id: string) => void
}

// One attached file: icon, name, size, upload progress or error, and Remove when the person can still change it.
export function FileChip({ file, onRemove }: FileChipProps) {
  const Icon = file.isImage ? ImageIcon : FileText
  const isUploading = file.status === 'uploading'
  const percent = Math.round((file.fraction ?? 0) * 100)
  return (
    <li
      className={cx(
        'inline-flex min-h-8 max-w-[260px] items-center gap-2 rounded-md border bg-sunken pl-2 text-small',
        file.status === 'error' ? 'border-danger' : 'border-edge',
        onRemove ? 'pr-1' : 'pr-2.5',
      )}
    >
      {isUploading ? (
        <Spinner />
      ) : file.status === 'error' ? (
        <WarningCircle size={16} className="shrink-0 text-danger" aria-hidden="true" />
      ) : (
        <Icon size={16} className="shrink-0 text-accent" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{file.name}</span>
      <span className="shrink-0 text-caption text-ink-2">
        {file.status === 'error' ? file.error : isUploading ? (percent > 0 ? `${percent}%` : 'Uploading') : formatFileSize(file.size)}
      </span>
      {onRemove && (
        <IconButton label={`Remove ${file.name}`} size="sm" className="size-6! pointer-coarse:size-8!" onPress={() => onRemove(file.id)}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      )}
    </li>
  )
}

export function FileChipList({ files, label, onRemove, align = 'start' }: { files: FileChipData[]; label: string; onRemove?: (id: string) => void; align?: 'start' | 'end' }) {
  if (files.length === 0) return null
  return (
    <ul aria-label={label} className={cx('flex flex-wrap gap-1.5', align === 'end' && 'justify-end')}>
      {files.map((file) => (
        <FileChip key={file.id} file={file} onRemove={onRemove} />
      ))}
    </ul>
  )
}
