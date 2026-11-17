// First focusable element on every screen. Targets the one <main>.
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(event) => {
        const main = document.getElementById('main')
        if (!main) return
        event.preventDefault()
        main.focus()
      }}
      className="fixed -top-16 left-2 z-[100] rounded-md border border-edge-strong bg-surface px-3 py-2 text-ink focus:top-2"
    >
      Skip to content
    </a>
  )
}
