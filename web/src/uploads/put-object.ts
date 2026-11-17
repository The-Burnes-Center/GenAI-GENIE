export interface PutProgress {
  fraction: number
}

// Presigned PUT to S3. XMLHttpRequest is used because fetch cannot report upload progress.
export function putObject(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  options: { onProgress?: (progress: PutProgress) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.({ fraction: event.loaded / event.total })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with HTTP ${xhr.status}.`))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'))

    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}
