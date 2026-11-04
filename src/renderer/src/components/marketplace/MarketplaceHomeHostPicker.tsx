import { ChevronDown, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { MarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'

type HostOption = { key: string | null; label: string; sub: string }

/** The header's host picker: the computer the page shows, and the hosts it can switch to. */
export function MarketplaceHomeHostPicker({
  host
}: {
  host: MarketplaceAppHost
}): React.JSX.Element {
  const thisComputer = translate(
    'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
    'This computer'
  )
  const options: HostOption[] = [
    { key: null, label: thisComputer, sub: '' },
    ...host.targets.map((target): HostOption => ({
      key: marketplaceHostKey(target),
      label: target.label,
      sub:
        target.kind === 'ssh'
          ? translate('auto.components.marketplace.MarketplaceHomeHostPicker.ssh', 'SSH')
          : translate(
              'auto.components.marketplace.MarketplaceHomeHostPicker.paired',
              'Paired server'
            )
    }))
  ]
  const shown = options.find((option) => option.key === host.selectedKey)
  const failed = host.selectedKey !== null && host.apps.status === 'failed'
  const statusLabel = failed
    ? translate(
        'auto.components.marketplace.MarketplaceHomeHostPicker.couldNotCheck',
        'Could not check'
      )
    : translate('auto.components.marketplace.MarketplaceHomeHostPicker.connected', 'Connected')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg">
          <span
            aria-hidden
            className={cn(
              'mr-2 size-2 rounded-full',
              failed ? 'bg-destructive' : 'bg-status-success'
            )}
          />
          <span className="mr-2">{shown?.label ?? thisComputer}</span>
          <span className="mr-2 text-[13px] font-normal text-muted-foreground">{statusLabel}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key ?? 'this-computer'}
            onSelect={() => host.select(option.key)}
          >
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5',
                option.key === host.selectedKey && 'bg-accent'
              )}
            >
              <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{option.label}</span>
                {option.sub ? (
                  <span className="text-xs text-muted-foreground">{option.sub}</span>
                ) : null}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
