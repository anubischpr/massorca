import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { OpenMetadataProfile } from '../../../../shared/marketplace-apps'
import { MarketplaceFormDialog, TextField, useFormSubmit } from './MarketplaceFormDialog'
import type { RunMarketplaceAction } from './use-marketplace-app-action'

type DialogProps = { run: RunMarketplaceAction; onClose: () => void }

/** Address and token for the OpenMetadata connection; the token is never shown back. */
export function OpenMetadataConnectDialog({ run, onClose }: DialogProps): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const form = useFormSubmit(run, onClose)
  const address = url.trim()
  const secret = token.trim()
  return (
    <MarketplaceFormDialog
      title={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.connectTitle',
        'Connect OpenMetadata'
      )}
      description={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.connectDescription',
        'MassOrca stores the token in the vault on this computer and never shows it again.'
      )}
      submitLabel={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.connect',
        'Connect'
      )}
      disabled={!address || !secret}
      pending={form.pending}
      error={form.error}
      onSubmit={() =>
        void form.submit((api) => api.connect({ id: 'openmetadata', url: address, token: secret }))
      }
      onClose={onClose}
    >
      <TextField
        id="marketplace-openmetadata-address"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.address', 'Address')}
        type="url"
        value={url}
        onChange={setUrl}
      />
      <TextField
        id="marketplace-openmetadata-token"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}

/** Replaces the stored OpenMetadata token; the old value is never shown. */
export function OpenMetadataTokenDialog({ run, onClose }: DialogProps): React.JSX.Element {
  const [token, setToken] = useState('')
  const form = useFormSubmit(run, onClose)
  const secret = token.trim()
  return (
    <MarketplaceFormDialog
      title={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.replaceTitle',
        'Replace the OpenMetadata token'
      )}
      description={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.replaceDescription',
        'The new token replaces the stored one in the vault. It is never shown again.'
      )}
      submitLabel={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.replace',
        'Replace'
      )}
      disabled={!secret}
      pending={form.pending}
      error={form.error}
      onSubmit={() => void form.submit((api) => api.setOpenMetadataToken({ token: secret }))}
      onClose={onClose}
    >
      <TextField
        id="marketplace-openmetadata-new-token"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}

/** Adds a profile from the OpenMetadata server, or saves changes to one already listed. */
export function OpenMetadataProfileDialog({
  profile,
  run,
  onClose
}: DialogProps & { profile: OpenMetadataProfile | null }): React.JSX.Element {
  const [name, setName] = useState(profile?.name ?? '')
  const [url, setUrl] = useState(profile?.url ?? '')
  const [token, setToken] = useState('')
  const form = useFormSubmit(run, onClose)
  const profileName = name.trim()
  const address = url.trim()
  const secret = token.trim()
  return (
    <MarketplaceFormDialog
      title={
        profile
          ? translate(
              'auto.components.marketplace.MarketplaceServerDialogs.editProfileTitle',
              'Edit {{name}}',
              { name: profile.name }
            )
          : translate(
              'auto.components.marketplace.MarketplaceServerDialogs.addProfileTitle',
              'Add a profile'
            )
      }
      description={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.profileDescription',
        'These profiles already exist on your OpenMetadata server. MassOrca stores the token in the vault and never creates or edits anything on the server.'
      )}
      submitLabel={
        profile
          ? translate('auto.components.marketplace.MarketplaceServerDialogs.save', 'Save')
          : translate(
              'auto.components.marketplace.MarketplaceServerDialogs.addProfile',
              'Add profile'
            )
      }
      disabled={!profileName || !address || !secret}
      pending={form.pending}
      error={form.error}
      onSubmit={() =>
        void form.submit((api) =>
          api.addOpenMetadataProfile({ name: profileName, url: address, token: secret })
        )
      }
      onClose={onClose}
    >
      <TextField
        id="marketplace-profile-name"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.name', 'Name')}
        value={name}
        onChange={setName}
        disabled={profile !== null}
      />
      <TextField
        id="marketplace-profile-address"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.address', 'Address')}
        type="url"
        value={url}
        onChange={setUrl}
      />
      <TextField
        id="marketplace-profile-token"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}

/** Sets the address of the user's own Engram server; a blank token keeps the current sign-in. */
export function EngramServerDialog({
  serverUrl,
  run,
  onClose
}: DialogProps & { serverUrl: string | null }): React.JSX.Element {
  const [url, setUrl] = useState(serverUrl ?? '')
  const [token, setToken] = useState('')
  const form = useFormSubmit(run, onClose)
  const address = url.trim()
  const secret = token.trim()
  return (
    <MarketplaceFormDialog
      title={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.engramTitle',
        'Your Engram server'
      )}
      description={translate(
        'auto.components.marketplace.MarketplaceServerDialogs.engramDescription',
        'Memories go to this server instead of staying on this computer. Leave the token empty to keep the current sign-in.'
      )}
      submitLabel={translate('auto.components.marketplace.MarketplaceServerDialogs.save', 'Save')}
      disabled={!address}
      pending={form.pending}
      error={form.error}
      onSubmit={() =>
        void form.submit((api) =>
          api.setEngramServer({ url: address, ...(secret ? { token: secret } : {}) })
        )
      }
      onClose={onClose}
    >
      <TextField
        id="marketplace-engram-server"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.address', 'Address')}
        type="url"
        value={url}
        onChange={setUrl}
      />
      <TextField
        id="marketplace-engram-token"
        label={translate('auto.components.marketplace.MarketplaceServerDialogs.token', 'Token')}
        type="password"
        value={token}
        onChange={setToken}
      />
    </MarketplaceFormDialog>
  )
}
