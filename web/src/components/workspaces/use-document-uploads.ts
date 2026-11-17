import { useCallback, useRef, useState } from 'react'
import { useAddWorkspaceDocument } from '../../api/workspaces'
import { toast } from '../ui'
import { uploadErrorMessage } from '../../uploads/upload-error-message'
import { uploadFile } from '../../uploads/upload-file'
import { classifyFile, validateUpload } from '../../uploads/validation'
import type { LocalUpload } from './document-rows'

// Copy for a rejected file: unknown types get the plain list of what Genie can read.
export function rejectionMessage(file: { name: string; size: number }): string | null {
  if (!classifyFile(file.name)) {
    const dot = file.name.lastIndexOf('.')
    const extension = dot === -1 ? 'those' : `.${file.name.slice(dot + 1).toLowerCase()}`
    return `Genie can't read ${extension} files. Use PDF, Word, Excel, CSV, HTML, text, or Markdown.`
  }
  const verdict = validateUpload(file, 'workspace')
  return verdict.ok ? null : verdict.message
}

// Validates each chosen file, then uploads the valid ones one after another and registers them.
export function useDocumentUploads(workspaceId: string) {
  const addDocument = useAddWorkspaceDocument(workspaceId)
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const queue = useRef<Promise<void>>(Promise.resolve())
  const counter = useRef(0)

  const patch = useCallback((id: string, change: Partial<LocalUpload>) => {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }, [])

  const run = useCallback(
    async (file: File, id: string) => {
      try {
        const uploaded = await uploadFile(file, 'workspace', workspaceId, {
          onProgress: ({ fraction }) => patch(id, { fraction }),
        })
        await addDocument.mutateAsync(uploaded)
        setUploads((current) => current.filter((item) => item.id !== id))
      } catch (error) {
        patch(id, { error: uploadErrorMessage(error) })
      }
    },
    [addDocument, patch, workspaceId],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const problem = rejectionMessage(file)
        if (problem) {
          toast.error(problem)
          continue
        }
        counter.current += 1
        const id = String(counter.current)
        setUploads((current) => [...current, { id, name: file.name, size: file.size, fraction: 0 }])
        queue.current = queue.current.then(() => run(file, id))
      }
    },
    [run],
  )

  const dismiss = useCallback((id: string) => setUploads((current) => current.filter((item) => item.id !== id)), [])

  return { uploads, addFiles, dismiss }
}
