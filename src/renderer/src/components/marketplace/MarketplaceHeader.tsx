import { Store, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'

export function MarketplaceHeader({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <header className="shrink-0 border-b border-border">
      <div className={cn(SKILLS_PAGE_COLUMN, 'flex items-center gap-2 py-3')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onClose}
              aria-label={translate(
                'auto.components.marketplace.MarketplaceHeader.close',
                'Close marketplace'
              )}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.marketplace.MarketplaceHeader.closeTooltip', 'Close')}
          </TooltipContent>
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-border/50" aria-hidden />
        <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">
            {translate('auto.components.marketplace.MarketplaceHeader.title', 'Marketplace')}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceHeader.subtitle',
              'Install tools and connect services for your agents on this computer.'
            )}
          </p>
        </div>
      </div>
    </header>
  )
}
