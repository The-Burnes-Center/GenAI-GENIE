import { describe, expect, it } from 'vitest'
import { createNdjsonParser, readNdjson } from './ndjson'

function collect(chunks: string[], finish = true): string[] {
  const lines: string[] = []
  const parser = createNdjsonParser((line) => lines.push(line))
  for (const chunk of chunks) parser.push(chunk)
  if (finish) parser.end()
  return lines
}

describe('createNdjsonParser', () => {
  it('joins a line that arrives across chunk boundaries', () => {
    const lines = collect(['{"type":"del', 'ta","text":"Hel"}\n{"type":"de', 'lta","text":"lo"}\n'])
    expect(lines).toEqual(['{"type":"delta","text":"Hel"}', '{"type":"delta","text":"lo"}'])
  })

  it('emits several lines that arrive in one chunk', () => {
    const lines = collect(['{"a":1}\n{"a":2}\n{"a":3}\n'])
    expect(lines).toEqual(['{"a":1}', '{"a":2}', '{"a":3}'])
  })

  it('splits on a newline that falls exactly at a chunk end', () => {
    expect(collect(['{"a":1}\n', '{"a":2}\n'])).toEqual(['{"a":1}', '{"a":2}'])
  })

  it('emits a final line that has no trailing newline when the stream ends', () => {
    expect(collect(['{"type":"done"}'])).toEqual(['{"type":"done"}'])
  })

  it('keeps a trailing partial line pending until end() is called', () => {
    expect(collect(['{"a":1}\n{"a"'], false)).toEqual(['{"a":1}'])
  })

  it('skips blank lines and strips carriage returns', () => {
    expect(collect(['{"a":1}\r\n\n   \n{"a":2}\r\n'])).toEqual(['{"a":1}', '{"a":2}'])
  })
})

describe('readNdjson', () => {
  it('decodes multi-byte UTF-8 split across byte chunks', async () => {
    const bytes = new TextEncoder().encode('{"text":"café"}\n')
    const split = [bytes.slice(0, 10), bytes.slice(10)]
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of split) controller.enqueue(part)
        controller.close()
      },
    })
    const lines: string[] = []
    await readNdjson(body, (line) => lines.push(line))
    expect(lines).toEqual(['{"text":"café"}'])
  })
})
