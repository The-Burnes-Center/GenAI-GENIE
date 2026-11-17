// The shell remounts the page when the path changes (/home to /chat/:id), so a chat that has just been
// created hands its messages to the new mount instead of showing a loading state and refetching.
export function createHandoffStore<T>() {
  const entries = new Map<string, T>()
  return {
    stash: (sessionId: string, value: T) => void entries.set(sessionId, value),
    peek: (sessionId: string): T | undefined => entries.get(sessionId),
    discard: (sessionId: string | undefined) => {
      if (sessionId) entries.delete(sessionId)
    },
  }
}
