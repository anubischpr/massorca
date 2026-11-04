import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type {
  MarketplaceRemoteCredentialSlot,
  MarketplaceVaultHostResult,
  MarketplaceVaultHostStatus
} from '../../../../shared/marketplace-apps'
import { MarketplaceFormDialog, TextField } from './MarketplaceFormDialog'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import {
  readVaultHost,
  setVaultHostToken,
  type MarketplaceVaultHostTarget
} from './marketplace-vault-host-client'
import {
  storedEncryptedOn,
  updatedAgo,
  vaultHostFailureMessage
} from './marketplace-vault-credential-text'

type HostView =
  | { kind: 'loading' }
  | { kind: 'ready'; status: MarketplaceVaultHostStatus }
  | { kind: 'failed'; message: string }

/** Hosts that keep their own vault: the active paired server and every connected SSH host. */
function useVaultHostTargets(): MarketplaceVaultHostTarget[] {
  const environmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const sshStates = useAppStore((s) => s.sshConnectionStates)
  const sshLabels = useAppStore((s) => s.sshTargetLabels)
  return useMemo(() => {
    const targets: MarketplaceVaultHostTarget[] = []
    const trimmed = environmentId?.trim()
    if (trimmed) {
      const name = environments.find((environment) => environment.id === trimmed)?.name
      targets.push({ kind: 'runtime', environmentId: trimmed, label: name || trimmed })
    }
    for (const [connectionId, state] of sshStates) {
      if (state.status === 'connected') {
        targets.push({
          kind: 'ssh',
          connectionId,
          label: sshLabels.get(connectionId) ?? connectionId
        })
      }
    }
    return targets
  }, [environmentId, environments, sshStates, sshLabels])
}

function targetKey(target: MarketplaceVaultHostTarget): string {
  return target.kind === 'ssh' ? `ssh:${target.connectionId}` : `runtime:${target.environmentId}`
}

function viewOf(result: MarketplaceVaultHostResult, label: string): HostView {
  return result.ok
    ? { kind: 'ready', status: result.status }
    : { kind: 'failed', message: vaultHostFailureMessage(result.reason, label) }
}

function hostText(view: HostView, slot: MarketplaceRemoteCredentialSlot, label: string): string {
  if (view.kind === 'loading') {
    return translate('auto.components.marketplace.MarketplaceVaultHosts.checking', 'Checking...')
  }
  if (view.kind === 'failed') {
    return view.message
  }
  const credential = view.status.credentials.find((candidate) => candidate.slot === slot)
  if (!credential?.stored) {
    return translate(
      'auto.components.marketplace.MarketplaceVaultHosts.notSetOn',
      'Not set on {{host}}',
      { host: label }
    )
  }
  const place = storedEncryptedOn(view.status.hostLabel)
  return credential.updatedAt === undefined
    ? place
    : `${place} · ${updatedAgo(credential.updatedAt)}`
}

function VaultHostRow({
  target,
  slot
}: {
  target: MarketplaceVaultHostTarget
  slot: MarketplaceRemoteCredentialSlot
}): React.JSX.Element {
  const [view, setView] = useState<HostView>({ kind: 'loading' })
  const [editing, setEditing] = useState(false)
  const reload = useCallback(async (): Promise<void> => {
    setView(viewOf(await readVaultHost(target), target.label))
  }, [target])
  useEffect(() => {
    void reload()
  }, [reload])

  const stored =
    view.kind === 'ready' &&
    view.status.credentials.some((credential) => credential.slot === slot && credential.stored)
  return (
    <>
      <MarketplaceInfoRow label={target.label}>
        <span className="text-sm text-muted-foreground">{hostText(view, slot, target.label)}</span>
        {view.kind === 'ready' ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {stored
              ? translate('auto.components.marketplace.MarketplaceVaultHosts.replace', 'Replace')
              : translate('auto.components.marketplace.MarketplaceVaultHosts.set', 'Set token')}
          </Button>
        ) : null}
      </MarketplaceInfoRow>
      {editing ? (
        <VaultTokenDialog
          target={target}
          slot={slot}
          replacing={stored}
          onClose={() => setEditing(false)}
          onDone={(result) => setView(viewOf(result, target.label))}
        />
      ) : null}
    </>
  )
}

/** Write-only: the token goes to that host's own vault once and is never shown or read back. */
function VaultTokenDialog({
  target,
  slot,
  replacing,
  onClose,
  onDone
}: {
  target: MarketplaceVaultHostTarget
  slot: MarketplaceRemoteCredentialSlot
  replacing: boolean
  onClose: () => void
  onDone: (result: MarketplaceVaultHostResult) => void
}): React.JSX.Element {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const secret = token.trim()
  const submit = async (): Promise<void> => {
    setPending(true)
    setError(null)
    const result = await setVaultHostToken(target, slot, secret)
    setPending(false)
    if (result.ok) {
      onDone(result)
      onClose()
    } else {
      setError(vaultHostFailureMessage(result.reason, target.label))
    }
  }
  return (
    <MarketplaceFormDialog
      title={
        replacing
          ? translate(
              'auto.components.marketplace.MarketplaceVaultHosts.replaceTitle',
              'Replace the token on {{host}}',
              { host: target.label }
            )
          : translate(
              'auto.components.marketplace.MarketplaceVaultHosts.setTitle',
              'Set the token on {{host}}',
              { host: target.label }
            )
      }
      description={translate(
        'auto.components.marketplace.MarketplaceVaultHosts.description',
        '{{host}} keeps the token in its own encrypted vault and gives it to the agents it runs. It is never shown again.',
        { host: target.label }
      )}
      submitLabel={
        replacing
          ? translate('auto.components.marketplace.MarketplaceVaultHosts.replace', 'Replace')
          : translate('auto.components.marketplace.MarketplaceVaultHosts.set', 'Set token')
      }
      disabled={!secret}
      pending={pending}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        id={`marketplace-vault-token-${targetKey(target)}`}
        label={translate('auto.components.marketplace.MarketplaceVaultHosts.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}

/** The same credential on the other hosts that run agents; renders nothing when there are none. */
export function MarketplaceVaultHosts({
  slot
}: {
  slot: MarketplaceRemoteCredentialSlot
}): React.JSX.Element | null {
  const targets = useVaultHostTargets()
  if (targets.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceVaultHosts.title',
          'On your other hosts'
        )}
      </span>
      {targets.map((target) => (
        <VaultHostRow key={targetKey(target)} target={target} slot={slot} />
      ))}
    </div>
  )
}
