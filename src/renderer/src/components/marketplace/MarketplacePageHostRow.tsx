import { MarketplaceHomeHostPicker } from './MarketplaceHomeHostPicker'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

/** The row above every Marketplace page: its way back on the left, the host picker on the right. */
export function MarketplacePageHostRow({
  host,
  children
}: {
  host: MarketplaceAppHost
  children: React.ReactNode
}): React.JSX.Element {
  // Why: every page shares this row, so no page can gate the picker again.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {children}
      <MarketplaceHomeHostPicker host={host} />
    </div>
  )
}
