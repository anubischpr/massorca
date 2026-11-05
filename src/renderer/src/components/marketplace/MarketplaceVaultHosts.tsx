import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  MarketplaceRemoteCredentialSlot,
  MarketplaceVaultHostResult,
  MarketplaceVaultHostStatus,
  MarketplaceVaultSlot
} from '../../../../shared/marketplace-apps'
import { MarketplaceFormDialog, TextField } from './MarketplaceFormDialog'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import {
  readVaultHost,
  setVaultHostToken,
  type MarketplaceVaultHostTarget
} from './marketplace-vault-host-client'
import {
  profileTokenNeedsUpdateMessage,
  vaultSlotFailureMessage
} from './marketplace-action-messages'
import { marketplaceHostKey, useMarketplaceHostTargets } from './use-marketplace-host-targets'
import { storedEncryptedOn, updatedAgo } from './marketplace-vault-credential-text'

const NO_PROFILES: readonly string[] = []

type HostView =
  | { kind: 'loading' }
  | { kind: 'ready'; status: MarketplaceVaultHostStatus }
  | { kind: 'failed'; message: string }

function viewOf(
  result: MarketplaceVaultHostResult,
  label: string,
  slot: MarketplaceVaultSlot
): HostView {
  return result.ok
    ? { kind: 'ready', status: result.status }
    : { kind: 'failed', message: vaultSlotFailureMessage(result.reason, label, slot) }
}

function credentialOf(
  status: MarketplaceVaultHostStatus,
  slot: MarketplaceVaultSlot
): { stored: boolean; updatedAt?: number } | undefined {
  return typeof slot === 'string'
    ? status.credentials.find((candidate) => candidate.slot === slot)
    : status.profiles?.find((candidate) => candidate.name === slot.name)
}

function hostText(view: HostView, slot: MarketplaceVaultSlot, label: string): string {
  if (view.kind === 'loading') {
    return translate('auto.components.marketplace.MarketplaceVaultHosts.checking', 'Checking...')
  }
  if (view.kind === 'failed') {
    return view.message
  }
  const credential = credentialOf(view.status, slot)
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

function VaultCredentialRow({
  target,
  slot,
  label,
  view,
  onResult
}: {
  target: MarketplaceVaultHostTarget
  slot: MarketplaceVaultSlot
  label: string
  view: HostView
  onResult: (result: MarketplaceVaultHostResult) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const stored = view.kind === 'ready' && credentialOf(view.status, slot)?.stored === true
  return (
    <>
      <MarketplaceInfoRow label={label}>
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
          onDone={onResult}
        />
      ) : null}
    </>
  )
}

/** A profile the host cannot take a token for yet, said in words instead of a button. */
function profileRowText(hostProfiles: boolean, label: string): string {
  return hostProfiles
    ? translate(
        'auto.components.marketplace.MarketplaceVaultHosts.profileNotOnHost',
        'Add this profile on {{host}} first.',
        { host: label }
      )
    : profileTokenNeedsUpdateMessage(label)
}

function profileRowLabel(host: string, profile: string): string {
  return translate(
    'auto.components.marketplace.MarketplaceVaultHosts.profileRow',
    '{{host}} · {{profile}}',
    { host, profile }
  )
}

function VaultHostRow({
  target,
  slot,
  profiles
}: {
  target: MarketplaceVaultHostTarget
  slot: MarketplaceRemoteCredentialSlot
  profiles: readonly string[]
}): React.JSX.Element {
  const [view, setView] = useState<HostView>({ kind: 'loading' })
  const reload = useCallback(async (): Promise<void> => {
    setView(viewOf(await readVaultHost(target), target.label, slot))
  }, [target, slot])
  useEffect(() => {
    void reload()
  }, [reload])

  // Why: profile tokens sit beside the main OpenMetadata one; a host that never sent a profile list
  // predates them, and a name only this computer knows needs adding on the host first.
  const hostProfiles = view.kind === 'ready' ? view.status.profiles : undefined
  const profileNames =
    slot === 'openmetadata' && view.kind === 'ready'
      ? [...new Set([...(hostProfiles ?? []).map((profile) => profile.name), ...profiles])]
      : []
  return (
    <>
      <VaultCredentialRow
        target={target}
        slot={slot}
        label={target.label}
        view={view}
        onResult={(result) => setView(viewOf(result, target.label, slot))}
      />
      {profileNames.map((name) =>
        hostProfiles?.some((profile) => profile.name === name) ? (
          <VaultCredentialRow
            key={name}
            target={target}
            slot={{ kind: 'openmetadata-profile', name }}
            label={profileRowLabel(target.label, name)}
            view={view}
            onResult={(result) =>
              setView(viewOf(result, target.label, { kind: 'openmetadata-profile', name }))
            }
          />
        ) : (
          <MarketplaceInfoRow key={name} label={profileRowLabel(target.label, name)}>
            <span className="text-sm text-muted-foreground">
              {profileRowText(hostProfiles !== undefined, target.label)}
            </span>
          </MarketplaceInfoRow>
        )
      )}
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
  slot: MarketplaceVaultSlot
  replacing: boolean
  onClose: () => void
  onDone: (result: MarketplaceVaultHostResult) => void
}): React.JSX.Element {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const secret = token.trim()
  const profile = typeof slot === 'string' ? null : slot.name
  const submit = async (): Promise<void> => {
    setPending(true)
    setError(null)
    const result = await setVaultHostToken(target, slot, secret)
    setPending(false)
    if (result.ok) {
      onDone(result)
      onClose()
    } else {
      setError(vaultSlotFailureMessage(result.reason, target.label, slot))
    }
  }
  const forProfile = profile ?? ''
  const subject = replacing
    ? profile === null
      ? translate(
          'auto.components.marketplace.MarketplaceVaultHosts.replaceTitle',
          'Replace the token on {{host}}',
          { host: target.label }
        )
      : translate(
          'auto.components.marketplace.MarketplaceVaultHosts.replaceProfileTitle',
          'Replace the {{profile}} token on {{host}}',
          { host: target.label, profile: forProfile }
        )
    : profile === null
      ? translate(
          'auto.components.marketplace.MarketplaceVaultHosts.setTitle',
          'Set the token on {{host}}',
          { host: target.label }
        )
      : translate(
          'auto.components.marketplace.MarketplaceVaultHosts.setProfileTitle',
          'Set the {{profile}} token on {{host}}',
          { host: target.label, profile: forProfile }
        )
  return (
    <MarketplaceFormDialog
      title={subject}
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
        id={`marketplace-vault-token-${marketplaceHostKey(target)}${profile === null ? '' : `-${profile}`}`}
        label={translate('auto.components.marketplace.MarketplaceVaultHosts.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}

/**
 * The same credential on the other hosts that run agents; renders nothing when there are none.
 * `profiles` names the extra OpenMetadata profiles this computer has, so a host that cannot hold
 * their tokens says so.
 */
export function MarketplaceVaultHosts({
  slot,
  profiles = NO_PROFILES
}: {
  slot: MarketplaceRemoteCredentialSlot
  profiles?: readonly string[]
}): React.JSX.Element | null {
  const targets = useMarketplaceHostTargets()
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
        <VaultHostRow
          key={marketplaceHostKey(target)}
          target={target}
          slot={slot}
          profiles={profiles}
        />
      ))}
    </div>
  )
}
