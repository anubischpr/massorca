import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { GitDetail } from './GitDetail'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'
import type { MarketplaceCatalogItem } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'

/** Git's own detail page; the other catalog items open the standard app page instead. */
export function MarketplaceDetail({
  item,
  badgeState,
  onBack
}: {
  item: MarketplaceCatalogItem
  badgeState: MarketplaceBadgeState
  onBack: () => void
}): React.JSX.Element {
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-5 py-4')}>
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.marketplace.MarketplaceDetail.back', 'Back')}
        </Button>
      </div>
      <div className="flex items-start gap-3">
        <MarketplaceItemIcon id={item.id} className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{item.name}</h2>
          <p className="text-sm text-muted-foreground">
            {translate(item.description.key, item.description.fallback)}
          </p>
        </div>
        <MarketplaceStatusBadge state={badgeState} />
      </div>
      <GitDetail state={badgeState} />
    </div>
  )
}
