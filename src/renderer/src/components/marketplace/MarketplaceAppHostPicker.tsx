import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

/** Picks which computer the page configures: this one, the paired server, or a connected SSH host. */
export function MarketplaceAppHostPicker({
  host
}: {
  host: Pick<MarketplaceAppHost, 'targets' | 'selectedKey' | 'select'>
}): React.JSX.Element | null {
  if (host.targets.length === 0) {
    return null
  }
  const options = [
    {
      key: null,
      label: translate(
        'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
        'This computer'
      )
    },
    ...host.targets.map((target) => ({ key: marketplaceHostKey(target), label: target.label }))
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {translate('auto.components.marketplace.MarketplaceAppHostPicker.label', 'Set up on')}
      </span>
      <div
        role="group"
        aria-label={translate(
          'auto.components.marketplace.MarketplaceAppHostPicker.groupLabel',
          'Computer to set up'
        )}
        className="flex flex-wrap gap-1"
      >
        {options.map((option) => (
          <Button
            key={option.key ?? 'local'}
            type="button"
            size="sm"
            variant={option.key === host.selectedKey ? 'secondary' : 'outline'}
            aria-pressed={option.key === host.selectedKey}
            onClick={() => host.select(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
