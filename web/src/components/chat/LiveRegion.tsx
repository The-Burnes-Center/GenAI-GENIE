// Visually hidden and polite. It says "thinking", "complete" or "stopped", never the text token by token.
export function LiveRegion({ text }: { text: string }) {
  return (
    <div className="vh" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  )
}
