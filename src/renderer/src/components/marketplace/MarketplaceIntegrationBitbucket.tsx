import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { readIpcErrorMessage } from '@/lib/ipc-error'
import { translate } from '@/i18n/i18n'
import type { BitbucketConnectionStatus } from '../../../../shared/bitbucket-credentials'
import { BitbucketCredentialsDialog } from '../settings/bitbucket-credentials-dialog'
import { usePreflightCardStatuses } from '../settings/source-control-preflight-card-status'
import { UnsealedCredentialNotice } from '../settings/UnsealedCredentialNotice'
import { ConnectionRow } from './MarketplaceAppConnection'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { useMarketplaceIntegrationStates } from './marketplace-integration-status'

const API_TOKEN_DOCS_URL = 'https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/'

/** The saved credential's metadata only, never the secret, so opening the page cannot prompt the keychain. */
function useBitbucketCredential(): {
  connection: BitbucketConnectionStatus | null
  loadFailed: boolean
  reload: () => Promise<void>
} {
  const mountedRef = useMountedRef()
  const [connection, setConnection] = useState<BitbucketConnectionStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    try {
      const next = await window.api.bitbucket.status()
      if (mountedRef.current && current === generation.current) {
        setConnection(next)
        setLoadFailed(false)
      }
    } catch {
      if (mountedRef.current && current === generation.current) {
        setLoadFailed(true)
      }
    }
  }, [mountedRef])
  useEffect(() => {
    void reload()
  }, [reload])
  return { connection, loadFailed, reload }
}

export function MarketplaceBitbucketIntegration(): React.JSX.Element {
  const state = useMarketplaceIntegrationStates().bitbucket
  const { statuses, refresh } = usePreflightCardStatuses('bitbucket')
  const { connection, loadFailed, reload } = useBitbucketCredential()
  const mountedRef = useMountedRef()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  const current = loadFailed ? null : connection
  const envManaged = current?.source === 'environment'
  const stored = current?.source === 'stored'
  const connected = state === 'connected'
  const account = current?.account ?? statuses.bitbucketAccount
  const reloadAll = (): void => {
    void reload()
    refresh()
  }

  const disconnect = async (): Promise<void> => {
    try {
      await window.api.bitbucket.disconnect()
    } catch (error) {
      // Why: disconnect rethrows when a credential file cannot be deleted; the page must say it is still connected.
      if (mountedRef.current) {
        setDisconnectError(
          readIpcErrorMessage(error) ??
            translate(
              'auto.components.settings.bitbucket.integration.card.disconnectFailed',
              'Could not remove the saved Bitbucket credential.'
            )
        )
      }
      throw error
    } finally {
      reloadAll()
    }
  }

  const connectLabel = stored
    ? translate('auto.components.settings.bitbucket.integration.card.edit', 'Edit credentials')
    : translate('auto.components.settings.bitbucket.integration.card.connect', 'Connect')
  const canEdit = state !== 'checking' && !envManaged && (current !== null || loadFailed)

  return (
    <>
      <MarketplaceIntegrationLayout
        id="bitbucket"
        state={state}
        headerAction={
          canEdit && !connected ? (
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
              {connectLabel}
            </Button>
          ) : null
        }
        connectionAction={
          canEdit && connected ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
              {connectLabel}
            </Button>
          ) : null
        }
        connection={
          <div className="flex flex-col gap-3">
            <UnsealedCredentialNotice
              protection={connection?.credentialProtection ?? null}
              credentialName={translate(
                'auto.components.settings.bitbucket.integration.card.credentialName',
                'Your Bitbucket credential'
              )}
            />
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <ConnectionRow
                icon={
                  <MarketplaceIntegrationIcon id="bitbucket" className="size-4 text-foreground" />
                }
                name={
                  connected
                    ? (account ??
                      translate(
                        'auto.components.settings.bitbucket.integration.card.accountUnknown',
                        'Bitbucket Cloud'
                      ))
                    : translate(
                        'auto.components.marketplace.MarketplaceIntegrationBitbucket.credential',
                        'Bitbucket credential'
                      )
                }
                sub={
                  envManaged
                    ? translate(
                        'auto.components.settings.bitbucket.integration.card.envManaged',
                        'Configured via environment variables. Unset the ORCA_BITBUCKET_* variables to manage this credential in MassOrca.'
                      )
                    : stored
                      ? translate(
                          'auto.components.settings.bitbucket.integration.card.storedCredential',
                          'Saved in MassOrca on this machine. ORCA_BITBUCKET_* environment variables take precedence when set.'
                        )
                      : translate(
                          'auto.components.marketplace.MarketplaceIntegrationBitbucket.notSet',
                          'Not set. Use an Atlassian API token or an access token.'
                        )
                }
                action={null}
              />
            </div>
            {state === 'unavailable' ? (
              <p className="text-sm">
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.24ac1c69dc',
                  'Bitbucket status is not available in this runtime yet.'
                )}
              </p>
            ) : null}
            {loadFailed ? (
              <p role="alert" className="text-sm text-destructive">
                {translate(
                  'auto.components.settings.bitbucket.integration.card.statusLoadFailed',
                  'Could not check for a saved Bitbucket credential.'
                )}
              </p>
            ) : null}
            {disconnectError ? (
              <p role="alert" className="text-sm text-destructive">
                {disconnectError}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              {!connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void window.api.shell.openUrl(API_TOKEN_DOCS_URL)}
                >
                  <ExternalLink />
                  {translate(
                    'auto.components.settings.token.source.control.integration.cards.1a9475dace',
                    'Learn more'
                  )}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={reloadAll}>
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.793a06e899',
                  'Re-check'
                )}
              </Button>
            </div>
          </div>
        }
        disconnects={
          stored
            ? [
                {
                  key: 'bitbucket',
                  title: translate(
                    'auto.components.settings.bitbucket.integration.card.disconnect',
                    'Disconnect Bitbucket'
                  ),
                  description: translate(
                    'auto.components.marketplace.MarketplaceIntegrationBitbucket.disconnectDescription',
                    'Deletes the Bitbucket credential saved in MassOrca on this machine. You can connect it again later.'
                  ),
                  onConfirm: disconnect
                }
              ]
            : []
        }
      />
      <BitbucketCredentialsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialAuthMode={current?.authMode}
        initialEmail={current?.email}
        initialBaseUrl={current?.baseUrl}
        environmentManaged={envManaged}
        onConnected={reloadAll}
      />
    </>
  )
}
