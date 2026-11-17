// DOM id of one source in the list under an answer, so a citation chip can jump to it.
export function sourceElementId(messageId: string, index: number): string {
  return `source-${messageId}-${index}`
}
