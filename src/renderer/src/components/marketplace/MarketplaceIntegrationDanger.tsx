import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceFormDialog } from './MarketplaceFormDialog'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'

/** One thing the page can disconnect, with the real call that does it. */
export type IntegrationDisconnect = {
  key: string
  title: string
  description: string
  onConfirm: () => Promise<void>
}

/**
 * Disconnecting is irreversible, so it sits alone at the end behind a confirmation. With nothing to
 * disconnect, the section stays and says why.
 */
export function MarketplaceIntegrationDanger({
  items,
  emptyNote
}: {
  items: readonly IntegrationDisconnect[]
  emptyNote: string
}): React.JSX.Element {
  const [confirming, setConfirming] = useState<IntegrationDisconnect | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (items.length === 0) {
    return (
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        <MarketplaceFunctionNote part="uninstall">{emptyNote}</MarketplaceFunctionNote>
      </MarketplaceAppSection>
    )
  }
  const close = (): void => {
    setConfirming(null)
    setError(null)
  }
  const submit = async (item: IntegrationDisconnect): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      await item.onConfirm()
      close()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : translate(
              'auto.components.marketplace.MarketplaceIntegrationDanger.failed',
              'Could not disconnect. Try again.'
            )
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <MarketplaceAppSection
      id="danger"
      title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
    >
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirming(item)}
            >
              {translate(
                'auto.components.marketplace.MarketplaceAppDanger.disconnect',
                'Disconnect'
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
      {confirming ? (
        <MarketplaceFormDialog
          title={translate(
            'auto.components.marketplace.MarketplaceIntegrationDanger.confirmTitle',
            '{{target}}?',
            { target: confirming.title }
          )}
          description={confirming.description}
          submitLabel={translate(
            'auto.components.marketplace.MarketplaceAppDialogs.disconnect',
            'Disconnect'
          )}
          destructive
          pending={pending}
          error={error}
          onSubmit={() => void submit(confirming)}
          onClose={close}
        />
      ) : null}
    </MarketplaceAppSection>
  )
}
