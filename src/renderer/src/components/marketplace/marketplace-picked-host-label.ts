import { translate } from '@/i18n/i18n'
import type { MarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'

/** The name of the host a page reads: the picked host, else This computer. */
export function pickedHostLabel(host: Pick<MarketplaceAppHost, 'targets' | 'selectedKey'>): string {
  return (
    host.targets.find((target) => marketplaceHostKey(target) === host.selectedKey)?.label ??
    translate('auto.components.marketplace.MarketplaceAppHostPicker.thisComputer', 'This computer')
  )
}
