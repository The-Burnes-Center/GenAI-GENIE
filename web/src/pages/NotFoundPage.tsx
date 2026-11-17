import { LinkButton } from '../components/ui'
import { useTopbar } from '../layout/topbar-context'

export function NotFoundPage() {
  useTopbar('Page not found')
  return (
    <div className="mx-auto grid min-h-full max-w-[520px] content-center justify-items-start gap-3 px-6 py-8">
      <span className="font-mono text-ink-3">Error 404</span>
      <h1 tabIndex={-1} className="text-display font-semibold">We can't find that page</h1>
      <p className="text-body text-ink-2">The link may be old, or the chat may have been deleted. Your other chats are safe.</p>
      <div className="flex flex-wrap gap-2">
        <LinkButton variant="primary" href="/home">Start a new chat</LinkButton>
        <LinkButton href="/history">Go to history</LinkButton>
      </div>
    </div>
  )
}
