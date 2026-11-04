import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { MarketplaceHomeHostPicker } from './MarketplaceHomeHostPicker'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

/** The page title row: the title, the host picker, and Add custom on the catalog. */
export function MarketplaceHeader({
  title,
  host,
  onAddCustom
}: {
  title: string
  host: MarketplaceAppHost
  onAddCustom?: () => void
}): React.JSX.Element {
  return (
    <header className="flex max-w-[1080px] flex-wrap items-center gap-2.5 px-10 pt-9 pb-5">
      <h1 className="min-w-0 grow text-2xl font-bold">{title}</h1>
      <MarketplaceHomeHostPicker host={host} />
      {onAddCustom ? (
        <Button variant="outline" size="lg" onClick={onAddCustom}>
          <Plus aria-hidden />
          {translate('auto.components.marketplace.MarketplaceHeader.addCustom', 'Add custom')}
        </Button>
      ) : null}
    </header>
  )
}
