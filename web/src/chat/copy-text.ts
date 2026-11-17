import { toast } from '../components/ui'

// Copies text and says so. The browser may refuse (no permission, insecure page), so the failure is shown too.
export async function copyText(text: string, successMessage = 'Copied to clipboard.'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.show(successMessage)
    return true
  } catch {
    toast.error('Copy was blocked by the browser. Select the text and copy it by hand.')
    return false
  }
}
