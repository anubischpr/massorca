import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { MarketplaceAppSection } from './MarketplaceAppSection'

/** Disconnect is the only irreversible action on the page, so it sits alone at the end. */
export function MarketplaceAppDanger({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const { appId, info } = ctx
  return (
    <MarketplaceAppSection
      id="danger"
      title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            {translate(
              'auto.components.marketplace.MarketplaceAppDanger.disconnectTitle',
              'Disconnect {{app}}',
              { app: info.name }
            )}
          </CardTitle>
          <CardDescription>
            {appId === 'github'
              ? translate(
                  'auto.components.marketplace.MarketplaceAppDanger.githubDescription',
                  'Removes GitHub from agents on this computer. It does not sign you out of the GitHub CLI (gh).'
                )
              : translate(
                  'auto.components.marketplace.MarketplaceAppDanger.description',
                  'Removes {{app}} and its skills from MassOrca on this computer. You can connect it again later.',
                  { app: info.name }
                )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => ctx.openDialog({ kind: 'disconnect' })}
          >
            {translate('auto.components.marketplace.MarketplaceAppDanger.disconnect', 'Disconnect')}
          </Button>
        </CardContent>
      </Card>
    </MarketplaceAppSection>
  )
}
