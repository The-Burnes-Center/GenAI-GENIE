import { useCallback, useRef, useState, type DragEvent } from 'react'

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

// Drag-and-drop over a whole area. Spread dropProps on the container; isDragging shows the accent wash.
export function useFileDrop(onFiles: (files: File[]) => void, isDisabled = false) {
  const [isDragging, setIsDragging] = useState(false)
  // dragenter and dragleave fire for every child, so count them to know when the pointer truly left.
  const depth = useRef(0)

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (isDisabled || !hasFiles(event)) return
      event.preventDefault()
      depth.current += 1
      setIsDragging(true)
    },
    [isDisabled],
  )
  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (isDisabled || !hasFiles(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [isDisabled],
  )
  const onDragLeave = useCallback((event: DragEvent) => {
    if (!hasFiles(event)) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsDragging(false)
  }, [])
  const onDrop = useCallback(
    (event: DragEvent) => {
      if (isDisabled || !hasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setIsDragging(false)
      onFiles(Array.from(event.dataTransfer.files))
    },
    [isDisabled, onFiles],
  )

  return { isDragging, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } }
}
