import { splitPlaceholders } from '../../chat/placeholders'

// Plain text with each [bracketed blank] marked. The brackets stay, so the mark never relies on color alone.
export function HighlightedText({ text }: { text: string }) {
  return (
    <>
      {splitPlaceholders(text).map((part, index) =>
        part.isPlaceholder ? (
          <mark key={index} className="rounded-xs bg-warm-soft px-0.5 font-medium text-warm-soft-ink underline decoration-warm decoration-dotted underline-offset-4">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}
