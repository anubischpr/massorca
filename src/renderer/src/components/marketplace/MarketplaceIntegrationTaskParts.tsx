import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { ConnectionRow } from './MarketplaceAppConnection'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'

export function AddAccessButton({
  label,
  connected,
  onClick
}: {
  label: string
  connected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button type="button" variant={connected ? 'ghost' : 'default'} size="sm" onClick={onClick}>
      {connected ? <Plus /> : null}
      {label}
    </Button>
  )
}

export function Checking({ app }: { app: string }): React.JSX.Element {
  return (
    <p className="text-sm text-muted-foreground">
      {translate(
        'auto.components.marketplace.MarketplaceIntegrationTaskParts.checking',
        'Checking {{app}} access…',
        { app }
      )}
    </p>
  )
}

export function NotConnectedRow({
  integration,
  name,
  sub,
  onAdd
}: {
  integration: 'linear' | 'jira'
  name: string
  sub: string
  onAdd: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <ConnectionRow
        icon={<MarketplaceIntegrationIcon id={integration} className="size-4 text-foreground" />}
        name={name}
        sub={sub}
        action={
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            {translate('auto.components.marketplace.MarketplaceIntegrationTaskParts.add', 'Add')}
          </Button>
        }
      />
    </div>
  )
}
