import { WarningCircle } from '@phosphor-icons/react'
import { Logo } from './brand/Logo'
import { Button } from './ui'

// Shown when /config.json cannot be loaded, before the router, theme or auth exist.
export function StartupError() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto grid min-h-dvh max-w-[440px] content-center justify-items-start gap-3.5 px-6 py-8 outline-none">
      <Logo height={28} />
      <span className="text-danger" aria-hidden="true"><WarningCircle size={36} /></span>
      <h1 className="text-h1 font-semibold">Genie could not start</h1>
      <p role="alert" className="text-body text-ink-2">
        The app settings could not be loaded. Reload the page. If this keeps happening, contact your administrator.
      </p>
      <Button variant="primary" onPress={() => window.location.reload()}>Reload the page</Button>
    </main>
  )
}
