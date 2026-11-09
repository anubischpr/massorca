import { translate } from '@/i18n/i18n'
import { ConnectionRow } from './MarketplaceAppConnection'
import {
  MarketplaceIntegrationAccessNote,
  MarketplaceIntegrationAccountScope
} from './MarketplaceIntegrationAdvanced'
import type { IntegrationDisconnect } from './MarketplaceIntegrationDanger'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import {
  disconnectRuntimeIntegration,
  useRuntimeIntegrationStatus,
  type RuntimeIntegrationId,
  type RuntimeIntegrationStatus
} from './MarketplaceIntegrationRuntimeHost'
import { notOnHostMessage } from './marketplace-integration-service-copy'
import {
  MARKETPLACE_INTEGRATIONS,
  type MarketplaceIntegrationState
} from './marketplace-integrations'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/**
 * Linear and Jira on a picked paired runtime show that runtime's own connections and can disconnect
 * them there. SSH and WSL hosts keep the plain notice, since no runtime path reaches them here.
 */
export function MarketplaceRuntimeScopedIntegration({
  id,
  target
}: {
  id: RuntimeIntegrationId
  target: MarketplaceVaultHostTarget
}): React.JSX.Element {
  if (target.kind === 'runtime') {
    return (
      <RuntimeHostIntegration
        id={id}
        environmentId={target.environmentId}
        hostLabel={target.label}
      />
    )
  }
  return (
    <MarketplaceIntegrationLayout
      id={id}
      state="unavailable"
      connection={
        <p className="text-sm">
          {target.kind === 'wsl'
            ? notOnHostMessage('wsl')
            : translate(
                'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.body',
                '{{app}} connects through the account scope MassOrca is using, not per host. Pick This computer to manage it, or change the scope under Remote Servers.',
                { app: MARKETPLACE_INTEGRATIONS[id].name }
              )}
        </p>
      }
      advanced={
        <>
          <MarketplaceIntegrationAccountScope />
          <MarketplaceIntegrationAccessNote id={id} />
        </>
      }
      disconnects={[]}
      dangerNote={translate(
        'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnect',
        'Disconnecting {{app}} on {{host}} is not available from this page yet.',
        { app: MARKETPLACE_INTEGRATIONS[id].name, host: target.label }
      )}
    />
  )
}

function RuntimeHostIntegration({
  id,
  environmentId,
  hostLabel
}: {
  id: RuntimeIntegrationId
  environmentId: string
  hostLabel: string
}): React.JSX.Element {
  const { status, reload } = useRuntimeIntegrationStatus(environmentId, id)
  const app = MARKETPLACE_INTEGRATIONS[id].name
  const connected = status.kind === 'ready' && status.connected
  const items = status.kind === 'ready' ? status.items : []

  const runDisconnect = async (itemId: string | null): Promise<void> => {
    try {
      await disconnectRuntimeIntegration(environmentId, id, itemId)
    } catch {
      await reload()
      throw new Error(
        translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnectFailed',
          'Could not disconnect {{app}} on {{host}}. Try again.',
          { app, host: hostLabel }
        )
      )
    }
    await reload()
  }

  const disconnects: IntegrationDisconnect[] = connected
    ? [
        {
          key: `${id}-all`,
          title: translate(
            'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnectAll',
            'Disconnect {{app}}',
            { app }
          ),
          description: translate(
            'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnectAllDescription',
            'Removes every {{app}} connection on {{host}} and deletes the keys stored for it. You can connect it again later.',
            { app, host: hostLabel }
          ),
          onConfirm: () => runDisconnect(null)
        },
        ...items.map((item) => ({
          key: `${id}-${item.id}`,
          title: translate(
            'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnectItem',
            'Disconnect {{name}}',
            { name: item.name }
          ),
          description: translate(
            'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.disconnectItemDescription',
            'Removes only this connection and its stored key on {{host}}.',
            { host: hostLabel }
          ),
          onConfirm: () => runDisconnect(item.id)
        }))
      ]
    : []

  return (
    <MarketplaceIntegrationLayout
      id={id}
      state={layoutState(status)}
      connection={<RuntimeConnectionRows id={id} status={status} hostLabel={hostLabel} />}
      advanced={
        <>
          <MarketplaceIntegrationAccountScope />
          <MarketplaceIntegrationAccessNote id={id} />
        </>
      }
      disconnects={disconnects}
      dangerNote={translate(
        'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.nothingToDisconnect',
        '{{app}} is not connected on {{host}}, so there is nothing to disconnect.',
        { app, host: hostLabel }
      )}
    />
  )
}

function layoutState(status: RuntimeIntegrationStatus): MarketplaceIntegrationState {
  if (status.kind === 'loading') {
    return 'checking'
  }
  if (status.kind !== 'ready') {
    return 'unavailable'
  }
  return status.connected ? 'connected' : 'not-connected'
}

function RuntimeConnectionRows({
  id,
  status,
  hostLabel
}: {
  id: RuntimeIntegrationId
  status: RuntimeIntegrationStatus
  hostLabel: string
}): React.JSX.Element {
  if (status.kind === 'loading') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.checking',
          'Checking {{host}}…',
          { host: hostLabel }
        )}
      </p>
    )
  }
  if (status.kind === 'update-required') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.updateRequired',
          'Update MassOrca on {{host}} first.',
          { host: hostLabel }
        )}
      </p>
    )
  }
  if (status.kind === 'failed') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.couldNotCheck',
          'Could not check {{host}}.',
          { host: hostLabel }
        )}
      </p>
    )
  }
  if (!status.connected) {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.notConnected',
          '{{app}} is not connected on {{host}}.',
          { app: MARKETPLACE_INTEGRATIONS[id].name, host: hostLabel }
        )}
      </p>
    )
  }
  if (status.items.length === 0) {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.connectedOn',
          'Connected on {{host}}.',
          { host: hostLabel }
        )}
      </p>
    )
  }
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {status.items.map((item) => (
        <ConnectionRow
          key={item.id}
          icon={<MarketplaceIntegrationIcon id={id} className="size-4 text-foreground" />}
          name={item.name}
          sub={translate(
            'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.connectedOn',
            'Connected on {{host}}.',
            { host: hostLabel }
          )}
          action={null}
        />
      ))}
    </div>
  )
}
