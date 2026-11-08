import { useState } from 'react'
import { LinearApiKeyDialog } from '@/components/linear-api-key-dialog'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { LinearAgentSkillInstallCta } from '../settings/linear-agent-skill-install-cta'
import { UnsealedCredentialNotice } from '../settings/UnsealedCredentialNotice'
import {
  MarketplaceIntegrationAccessNote,
  MarketplaceIntegrationAccountScope
} from './MarketplaceIntegrationAdvanced'
import {
  MarketplaceIntegrationAccounts,
  type IntegrationAccount
} from './MarketplaceIntegrationAccounts'
import type { IntegrationDisconnect } from './MarketplaceIntegrationDanger'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { AddAccessButton, Checking, NotConnectedRow } from './MarketplaceIntegrationTaskParts'
import { useLinearConnectionState } from './marketplace-integration-status'

export function MarketplaceLinearIntegration(): React.JSX.Element {
  const { checking, connected } = useLinearConnectionState()
  const status = useAppStore((s) => s.linearStatus)
  const settings = useAppStore((s) => s.settings)
  const disconnectLinear = useAppStore((s) => s.disconnectLinear)
  const disconnectLinearWorkspace = useAppStore((s) => s.disconnectLinearWorkspace)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const testLinearConnection = useAppStore((s) => s.testLinearConnection)
  const [dialogOpen, setDialogOpen] = useState(false)

  const workspaces = status.workspaces ?? []
  const accounts: IntegrationAccount[] = workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.organizationName,
    detail: workspace.email
      ? `${workspace.displayName} · ${workspace.email}`
      : workspace.displayName
  }))
  const addLabel = connected
    ? translate(
        'auto.components.marketplace.MarketplaceIntegrationTaskProviders.addWorkspace',
        'Add workspace access'
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
            'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectLinear',
            'Disconnect Linear'
          ),
          description: translate(
            'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectLinearDescription',
            'Removes every connected Linear workspace and deletes the keys stored for it. You can connect it again later.'
          ),
          onConfirm: () => disconnectLinear()
        },
        ...(workspaces.length > 1
          ? workspaces.map((workspace) => ({
              key: workspace.id,
              title: translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectWorkspace',
                'Disconnect {{name}}',
                { name: workspace.organizationName }
              ),
              description: translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.disconnectWorkspaceDescription',
                'Removes only this workspace and its stored key.'
              ),
              onConfirm: () => disconnectLinearWorkspace(workspace.id)
            }))
          : [])
      ]
    : []

  return (
    <>
      <MarketplaceIntegrationLayout
        id="linear"
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
                'auto.components.settings.task.tracker.integration.cards.linearTokenName',
                'Your Linear API token'
              )}
            />
            {checking ? <Checking app="Linear" /> : null}
            {!checking && connected ? (
              <MarketplaceIntegrationAccounts
                integration="linear"
                accounts={accounts}
                onTest={(workspaceId) => testLinearConnection(workspaceId)}
              />
            ) : null}
            {!checking && !connected ? (
              <NotConnectedRow
                integration="linear"
                name={translate(
                  'auto.components.marketplace.MarketplaceIntegrationTaskProviders.linearKey',
                  'Linear API key'
                )}
                sub={translate(
                  'auto.components.marketplace.MarketplaceIntegrationTaskProviders.linearKeyNotSet',
                  'Not set. Use a Personal API key from your Linear settings.'
                )}
                onAdd={open}
              />
            ) : null}
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceIntegrationTaskProviders.linearHelp',
                'Each connected workspace has one key, stored by the active runtime. Full-access keys can see every team the key owner can reach.'
              )}
            </p>
            {!checking && !connected ? (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void checkLinearConnection(true)}
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
        advanced={
          <>
            <MarketplaceIntegrationAccountScope />
            <LinearAgentSkillInstallCta settings={settings} />
            <MarketplaceIntegrationAccessNote id="linear" />
          </>
        }
        disconnects={disconnects}
        dangerNote={translate(
          'auto.components.marketplace.MarketplaceIntegrationTaskProviders.linearNotConnected',
          'Linear is not connected, so there is nothing to disconnect.'
        )}
      />
      <LinearApiKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connectLabel="Add Linear access"
      />
    </>
  )
}
