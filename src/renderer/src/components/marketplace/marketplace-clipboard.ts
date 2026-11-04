import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

/** Copies text for the user and says so; a refused copy is reported, never silent. */
export async function copyMarketplaceText(text: string): Promise<void> {
  try {
    await window.api.ui.writeClipboardText(text)
    toast.success(
      translate('auto.components.marketplace.marketplace-clipboard.copied', 'Copied to clipboard')
    )
  } catch {
    toast.error(
      translate('auto.components.marketplace.marketplace-clipboard.copyFailed', 'Could not copy')
    )
  }
}
