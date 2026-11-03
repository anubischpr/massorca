import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { EngramDetail } from './EngramDetail'
import { GitDetail } from './GitDetail'
import { GitHubDetail } from './GitHubDetail'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'
import { OpenMetadataDetail } from './OpenMetadataDetail'
import type { MarketplaceCatalogItem } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import type { MarketplaceDetectionState } from './use-marketplace-detection'

export function MarketplaceDetail({
  item,
  badgeState,
  detection,
  onBack,
  onDetectionChanged
}: {
  item: MarketplaceCatalogItem
  badgeState: MarketplaceBadgeState
  detection: MarketplaceDetectionState
  onBack: () => void
  onDetectionChanged: () => Promise<void>
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
      <MarketplaceDetailBody
        item={item}
        badgeState={badgeState}
        detection={detection}
        onDetectionChanged={onDetectionChanged}
      />
    </div>
  )
}

function MarketplaceDetailBody({
  item,
  badgeState,
  detection,
  onDetectionChanged
}: {
  item: MarketplaceCatalogItem
  badgeState: MarketplaceBadgeState
  detection: MarketplaceDetectionState
  onDetectionChanged: () => Promise<void>
}): React.JSX.Element {
  if (item.id === 'git') {
    return <GitDetail state={badgeState} />
  }
  if (item.id === 'github') {
    return <GitHubDetail state={badgeState} />
  }
  if (detection.status !== 'ready') {
    return <DetectionNotice status={detection.status} onRetry={onDetectionChanged} />
  }
  if (item.id === 'engram') {
    return <EngramDetail detection={detection.detection} onChanged={onDetectionChanged} />
  }
  return <OpenMetadataDetail detection={detection.detection} />
}

function DetectionNotice({
  status,
  onRetry
}: {
  status: 'loading' | 'unavailable' | 'failed'
  onRetry: () => Promise<void>
}): React.JSX.Element {
  if (status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceDetail.checking',
          'Checking this computer…'
        )}
      </p>
    )
  }
  if (status === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceDetail.desktopOnly',
          'Available in the desktop app'
        )}
      </p>
    )
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceDetail.failed',
          'Could not check this computer.'
        )}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => void onRetry()}>
        {translate('auto.components.marketplace.MarketplaceDetail.retry', 'Try again')}
      </Button>
    </div>
  )
}
