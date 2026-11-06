import { useState } from 'react'
import { JiraConnectDialog } from '@/components/jira-connect-dialog'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { UnsealedCredentialNotice } from '../settings/UnsealedCredentialNotice'
import { MarketplaceIntegrationAccountScope } from './MarketplaceIntegrationAdvanced'
import {
  MarketplaceIntegrationAccounts,
  type IntegrationAccount
} from './MarketplaceIntegrationAccounts'
import type { IntegrationDisconnect } from './MarketplaceIntegrationDanger'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { AddAccessButton, Checking, NotConnectedRow } from './MarketplaceIntegrationTaskParts'
import { useJiraConnectionState } from './marketplace-integration-status'

export function MarketplaceJiraIntegration(): React.JSX.Element {
  const { checking, connected } = useJiraConnectionState()
  const status = useAppStore((s) => s.jiraStatus)
  const disconnectJira = useAppStore((s) => s.disconnectJira)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const testJiraConnection = useAppStore((s) => s.testJiraConnection)
  const [dialogOpen, setDialogOpen] = useState(false)

  const sites = status.sites ?? []
  const accounts: IntegrationAccount[] = sites.map((site) => ({
    id: site.id,
    name: site.displayName,
    detail: site.email ? `${site.siteUrl} · ${site.email}` : site.siteUrl
  }))
  const addLabel = connected
    ? translate(
        'auto.components.marketplace.MarketplaceIntegrationTaskProviders.addSite',
        'Add Jira site'
      )
    : translate(
        'auto.components.marketplace.MarketplaceIntegrationTaskProviders.connect',
        'Connect'
      )
  const open = (): void => setDialogOpen(true)

  const disconnects: IntegrationDisconnect[] = connected
    ? [
        {
          key: 'all',
          title: translate(
            'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectJira',
            'Disconnect Jira'
          ),
          description: translate(
            'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectJiraDescription',
            'Removes every connected Jira site and deletes the tokens stored for it. You can connect it again later.'
          ),
          onConfirm: () => disconnectJira()
        },
        ...(sites.length > 1
          ? sites.map((site) => ({
              key: site.id,
              title: translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectSite',
                'Disconnect {{name}}',
                { name: site.displayName }
              ),
              description: translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectSiteDescription',
                'Removes only this site and its stored token.'
              ),
              onConfirm: () => disconnectJira(site.id)
            }))
          : [])
      ]
    : []

  return (
    <>
      <MarketplaceIntegrationLayout
        id="jira"
        state={checking ? 'checking' : connected ? 'connected' : 'not-connected'}
        headerAction={
          !checking && !connected ? (
            <AddAccessButton label={addLabel} connected={false} onClick={open} />
          ) : null
        }
        connectionAction={
          connected ? <AddAccessButton label={addLabel} connected onClick={open} /> : null
        }
        connection={
          <div className="flex flex-col gap-3">
            <UnsealedCredentialNotice
              protection={status.credentialProtection ?? null}
              credentialName={translate(
                'auto.components.settings.jira.integration.card.jiraTokenName',
                'Your Jira API token'
              )}
            />
            {checking ? <Checking app="Jira" /> : null}
            {!checking && connected && accounts.length > 0 ? (
              <MarketplaceIntegrationAccounts
                integration="jira"
                accounts={accounts}
                onTest={(siteId) => testJiraConnection(siteId)}
              />
            ) : null}
            {!checking && connected && accounts.length === 0 ? (
              <p className="text-sm">
                {translate(
                  'auto.components.settings.task.tracker.integration.cards.8b2408a8e5',
                  'Jira is connected for this runtime. Re-check if the connected site list looks stale.'
                )}
              </p>
            ) : null}
            {!checking && !connected ? (
              <NotConnectedRow
                integration="jira"
                name={translate(
                  'auto.components.marketplace.MarketplaceIntegrationTaskProviders.jiraCredential',
                  'Jira credentials'
                )}
                sub={translate(
                  'auto.components.marketplace.MarketplaceIntegrationTaskProviders.jiraCredentialNotSet',
                  'Not set. Jira Cloud takes an API token; a self-hosted Jira takes a personal access token or a username and password.'
                )}
                onAdd={open}
              />
            ) : null}
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.jiraHelp',
                'Each connected site has one token, stored by the active runtime.'
              )}
            </p>
            {!checking ? (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void checkJiraConnection()}
                >
                  {translate(
                    'auto.components.settings.task.tracker.integration.cards.c90f2ef419',
                    'Re-check'
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        }
        advanced={<MarketplaceIntegrationAccountScope />}
        disconnects={disconnects}
      />
      <JiraConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
