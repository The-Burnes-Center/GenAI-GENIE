// Splits a byte stream of newline-delimited JSON into lines, whatever the chunk boundaries.

export interface NdjsonParser {
  push: (chunk: string) => void
  end: () => void
}

export function createNdjsonParser(onLine: (line: string) => void): NdjsonParser {
  let pending = ''

  function emit(raw: string): void {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (line.trim() !== '') onLine(line)
  }

  return {
    push(chunk: string) {
      pending += chunk
      let newline = pending.indexOf('\n')
      while (newline !== -1) {
        emit(pending.slice(0, newline))
        pending = pending.slice(newline + 1)
        newline = pending.indexOf('\n')
      }
    },
    end() {
      if (pending !== '') emit(pending)
      pending = ''
    },
  }
}

// Reads a response body to the end, decoding UTF-8 that may split across chunks.
export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parser = createNdjsonParser(onLine)
  try {
    let result = await reader.read()
    while (!result.done) {
      parser.push(decoder.decode(result.value, { stream: true }))
      result = await reader.read()
    }
    parser.push(decoder.decode())
    parser.end()
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
}
