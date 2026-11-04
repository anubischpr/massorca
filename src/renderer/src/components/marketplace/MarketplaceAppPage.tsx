import { useCallback, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import type { MarketplaceAppId, MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import { MarketplaceAppAdvanced } from './MarketplaceAppAdvanced'
import { MarketplaceAppBanner } from './MarketplaceAppBanner'
import { MarketplaceAppConnection } from './MarketplaceAppConnection'
import { MarketplaceAppDanger } from './MarketplaceAppDanger'
import { MarketplaceAppDialogs } from './MarketplaceAppDialogs'
import { MarketplaceAppHeader } from './MarketplaceAppHeader'
import { MarketplaceAppHostPicker } from './MarketplaceAppHostPicker'
import { MarketplaceAppInformation } from './MarketplaceAppInformation'
import type { MarketplaceAppContext, MarketplaceAppDialog } from './marketplace-app-context'
import { MARKETPLACE_APP_INFO } from './marketplace-app-info'
import { appStatusFor } from './marketplace-status'
import { useGitHubAccounts } from './use-github-accounts'
import { useMarketplaceAppAction, type MarketplacePerform } from './use-marketplace-app-action'
import { useMarketplaceAppHost } from './use-marketplace-app-host'
import { useMarketplacePreflight } from './use-marketplace-preflight'

/** The standard page for Engram, OpenMetadata and GitHub: header, banner, then the sections. */
export function MarketplaceAppPage({
  appId,
  onBack
}: {
  appId: MarketplaceAppId
  onBack: () => void
}): React.JSX.Element {
  const host = useMarketplaceAppHost()
  const { apps } = host
  const runAction = useMarketplaceAppAction(host.scope)
  const preflight = useMarketplacePreflight({ refreshOnMount: false })
  const github = useGitHubAccounts(appId === 'github')
  const [dialog, setDialog] = useState<MarketplaceAppDialog | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const runInline = useCallback(
    async (perform: MarketplacePerform) => {
      setPageError(null)
      const outcome = await runAction(perform)
      if (!outcome.ok) {
        setPageError(outcome.message)
      }
      return outcome
    },
    [runAction]
  )

  const ready = apps.status === 'ready'
  const status: MarketplaceAppStatus = appStatusFor(apps, appId) ?? {
    id: appId,
    connected: false,
    agents: []
  }
  const connectBlocked = appId === 'engram' && status.program?.found === false
  const connect = useCallback(() => {
    if (appId === 'openmetadata') {
      setDialog({ kind: 'openmetadata-connect' })
    } else {
      void runInline((api) => api.connect({ id: appId }))
    }
  }, [appId, runInline])

  const ctx: MarketplaceAppContext = {
    appId,
    ready,
    status,
    hostLabel: host.scope?.label ?? null,
    info: MARKETPLACE_APP_INFO[appId],
    preflight,
    github,
    canConnect: ready && !status.connected,
    connectBlocked,
    connect,
    openDialog: setDialog,
    run: runAction,
    runInline
  }

  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-6 py-4')}>
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.marketplace.MarketplaceAppPage.back', 'Back')}
        </Button>
      </div>
      {appId === 'github' ? null : <MarketplaceAppHostPicker host={host} />}
      <MarketplaceAppHeader ctx={ctx} />
      <MarketplaceAppBanner appId={appId} />
      {pageError ? (
        <p role="alert" className="text-sm text-destructive">
          {pageError}
        </p>
      ) : null}
      <AppPageBody apps={apps} ctx={ctx} failure={host.failure} onRetry={host.retry} />
      <MarketplaceAppDialogs ctx={ctx} dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

function AppPageBody({
  apps,
  ctx,
  failure,
  onRetry
}: {
  apps: MarketplaceAppsState
  ctx: MarketplaceAppContext
  failure: string | null
  onRetry: () => void
}): React.JSX.Element {
  if (apps.status === 'unavailable') {
    return (
      <Notice>
        {translate(
          'auto.components.marketplace.MarketplaceAppPage.desktopOnly',
          'Available in the desktop app'
        )}
      </Notice>
    )
  }
  if (apps.status === 'loading') {
    return (
      <Notice>
        {ctx.hostLabel
          ? translate(
              'auto.components.marketplace.MarketplaceAppPage.checkingHost',
              'Checking {{host}}…',
              { host: ctx.hostLabel }
            )
          : translate(
              'auto.components.marketplace.MarketplaceAppPage.checking',
              'Checking this computer…'
            )}
      </Notice>
    )
  }
  if (apps.status === 'failed') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Notice>
          {failure ??
            translate(
              'auto.components.marketplace.MarketplaceAppPage.failed',
              'Could not check this computer.'
            )}
        </Notice>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {translate('auto.components.marketplace.MarketplaceAppPage.retry', 'Try again')}
        </Button>
      </div>
    )
  }
  return (
    <>
      <MarketplaceAppConnection ctx={ctx} />
      <MarketplaceAppInformation ctx={ctx} />
      <MarketplaceAppAdvanced ctx={ctx} />
      <MarketplaceAppDanger ctx={ctx} />
    </>
  )
}

function Notice({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
