import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { MarketplaceServiceId } from '../../../../shared/marketplace-services'
import { UnsealedCredentialNotice } from '../settings/UnsealedCredentialNotice'
import { ConnectionRow } from './MarketplaceAppConnection'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { MarketplaceIntegrationServiceDialog } from './MarketplaceIntegrationServiceDialog'
import {
  GITLAB_INSTALL_URL,
  serviceCopy,
  serviceIntegrationState,
  serviceSubtitle
} from './marketplace-integration-service-copy'
import { useMarketplaceServiceHost, type ServiceHost } from './marketplace-integration-service-host'
import { MARKETPLACE_INTEGRATIONS } from './marketplace-integrations'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

const COPY = 'auto.components.marketplace.MarketplaceIntegrationService'

function openUrl(url: string): void {
  void window.api.shell.openUrl(url)
}

function useServiceIntegrationHost(
  service: MarketplaceServiceId,
  target: MarketplaceVaultHostTarget | null
): ServiceHost {
  const host = useMarketplaceServiceHost(service, target)
  const refreshPreflight = useAppStore((s) => s.refreshPreflightStatus)
  // Why: this computer's catalog rows read the preflight store, so a change here refreshes it too.
  const withRefresh = <T extends { ok: boolean }>(run: Promise<T>): Promise<T> =>
    run.then((outcome) => {
      if (outcome.ok && target === null) {
        void refreshPreflight({ force: true })
      }
      return outcome
    })
  return {
    ...host,
    connect: (args) => withRefresh(host.connect(args)),
    disconnect: () => withRefresh(host.disconnect())
  }
}

/**
 * GitLab, Bitbucket, Azure DevOps and Gitea: connect with a token typed on the page, saved on the
 * picked host, and removed again from the Danger zone.
 */
export function MarketplaceServiceIntegration({
  service,
  target
}: {
  service: MarketplaceServiceId
  target: MarketplaceVaultHostTarget | null
}): React.JSX.Element {
  const host = useServiceIntegrationHost(service, target)
  const [dialogOpen, setDialogOpen] = useState(false)
  const app = MARKETPLACE_INTEGRATIONS[service]
  const copy = serviceCopy(service, app.name)
  const { state } = host
  const integrationState = serviceIntegrationState(state)
  const ready = state.kind === 'ready' ? state : null
  const connected = integrationState === 'connected'
  const stored = ready?.entry.source === 'stored'
  const cliMissing = service === 'gitlab' && ready?.entry.cliInstalled === false
  const canConnect = ready !== null && !cliMissing
  const bitbucketAccount = service === 'bitbucket' ? ready?.entry.account : undefined
  const connectLabel = connected ? copy.replaceLabel : copy.connectLabel

  const disconnect = async (): Promise<void> => {
    const outcome = await host.disconnect()
    if (!outcome.ok) {
      throw new Error(outcome.message)
    }
  }

  return (
    <>
      <MarketplaceIntegrationLayout
        id={service}
        state={integrationState}
        headerAction={
          canConnect && !connected ? (
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
              {connectLabel}
            </Button>
          ) : null
        }
        connectionAction={
          canConnect && connected ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
              {connectLabel}
            </Button>
          ) : null
        }
        connection={
          <div className="flex flex-col gap-3">
            <UnsealedCredentialNotice
              protection={ready?.entry.credentialProtection ?? null}
              credentialName={translate(`${COPY}.credentialName`, 'Your {{app}} credential', {
                app: app.name
              })}
            />
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <ConnectionRow
                icon={
                  <MarketplaceIntegrationIcon id={service} className="size-4 text-foreground" />
                }
                name={bitbucketAccount ?? copy.cardName}
                sub={serviceSubtitle(service, state, host.hostLabel)}
                action={null}
              />
            </div>
            {cliMissing ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm">
                  {translate(
                    `${COPY}.installGitlab`,
                    'Install the GitLab CLI on {{host}} to enable merge requests, issues, and pipelines.',
                    { host: host.hostLabel }
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openUrl(GITLAB_INSTALL_URL)}
                >
                  <ExternalLink />
                  {translate(`${COPY}.installGitlabButton`, 'Install GitLab CLI')}
                </Button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openUrl(copy.learnMoreUrl)}
              >
                <ExternalLink />
                {translate(`${COPY}.learnMore`, 'Learn more')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={host.reload}>
                {translate(`${COPY}.recheck`, 'Re-check')}
              </Button>
            </div>
          </div>
        }
        disconnects={
          stored
            ? [
                {
                  key: service,
                  title: translate(`${COPY}.disconnectTitle`, 'Disconnect {{app}}', {
                    app: app.name
                  }),
                  description: translate(
                    `${COPY}.disconnectDescription`,
                    'Deletes the {{app}} token saved on {{host}}. You can connect it again later.',
                    { app: app.name, host: host.hostLabel }
                  ),
                  onConfirm: disconnect
                }
              ]
            : []
        }
      />
      {dialogOpen ? (
        <MarketplaceIntegrationServiceDialog
          copy={copy}
          hostLabel={host.hostLabel}
          onSubmit={host.connect}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  )
}
