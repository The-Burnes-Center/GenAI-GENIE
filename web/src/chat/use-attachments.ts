import { useCallback, useEffect, useRef, useState } from 'react'
import type { AttachmentRef } from '../api/types'
import { uploadErrorMessage } from '../uploads/upload-error-message'
import { uploadFile } from '../uploads/upload-file'
import { classifyFile } from '../uploads/validation'
import { screenNewFiles } from './attach-rules'
import { newLocalId } from './messages'

export type AttachmentStatus = 'uploading' | 'ready' | 'error'

export interface AttachmentItem {
  id: string
  name: string
  size: number
  isImage: boolean
  status: AttachmentStatus
  // 0 to 1 while uploading. Stays 0 when the browser cannot report progress.
  fraction: number
  ref?: AttachmentRef
  error?: string
}

function toItem(file: File): AttachmentItem {
  return {
    id: newLocalId(),
    name: file.name,
    size: file.size,
    isImage: classifyFile(file.name) === 'image',
    status: 'uploading',
    fraction: 0,
  }
}

// Files are uploaded as soon as they are attached, so Send is instant and chips show progress.
export function useAttachments() {
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const controllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    const active = controllers.current
    return () => active.forEach((controller) => controller.abort())
  }, [])

  const patch = useCallback((id: string, change: Partial<AttachmentItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }, [])

  const startUpload = useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController()
      controllers.current.set(id, controller)
      try {
        const ref = await uploadFile(file, 'attachment', undefined, {
          signal: controller.signal,
          onProgress: ({ fraction }) => patch(id, { fraction }),
        })
        patch(id, { status: 'ready', fraction: 1, ref })
      } catch (error) {
        if (!controller.signal.aborted) patch(id, { status: 'error', error: uploadErrorMessage(error) })
      } finally {
        controllers.current.delete(id)
      }
    },
    [patch],
  )

  const add = useCallback(
    (incoming: File[]) => {
      const { accepted, problems: refused } = screenNewFiles(items, incoming)
      setProblems(refused)
      const fresh = accepted.map((file) => ({ file, item: toItem(file) }))
      if (fresh.length === 0) return
      setItems((current) => [...current, ...fresh.map(({ item }) => item)])
      fresh.forEach(({ file, item }) => void startUpload(item.id, file))
    },
    [items, startUpload],
  )

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort())
    setItems([])
    setProblems([])
  }, [])

  const dismissProblems = useCallback(() => setProblems([]), [])
  const isUploading = items.some((item) => item.status === 'uploading')
  const hasFailed = items.some((item) => item.status === 'error')
  const refs = items.flatMap((item) => (item.ref ? [item.ref] : []))
  return { items, problems, isUploading, hasFailed, refs, add, remove, clear, dismissProblems }
}
