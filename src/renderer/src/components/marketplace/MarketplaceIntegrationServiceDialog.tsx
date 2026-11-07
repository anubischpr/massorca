import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { MarketplaceFormDialog, TextField } from './MarketplaceFormDialog'
import type { ServiceCopy } from './marketplace-integration-service-copy'
import type { ServiceActionOutcome } from './marketplace-integration-service-host'

/** The token entry: a failure stays inside the dialog, and the token is dropped once it is sent. */
export function MarketplaceIntegrationServiceDialog({
  copy,
  hostLabel,
  onSubmit,
  onClose
}: {
  copy: ServiceCopy
  hostLabel: string
  onSubmit: (values: {
    token: string
    baseUrl?: string
    email?: string
  }) => Promise<ServiceActionOutcome>
  onClose: () => void
}): React.JSX.Element {
  const [token, setToken] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fields } = copy

  const submit = async (): Promise<void> => {
    setPending(true)
    setError(null)
    const baseUrl = address.trim()
    const mail = email.trim()
    const outcome = await onSubmit({
      token: token.trim(),
      ...(baseUrl ? { baseUrl } : {}),
      ...(fields.email && mail ? { email: mail } : {})
    })
    setPending(false)
    if (outcome.ok) {
      onClose()
    } else {
      setError(outcome.message)
    }
  }

  return (
    <MarketplaceFormDialog
      title={copy.dialogTitle}
      description={copy.dialogDescription}
      submitLabel={translate(
        'auto.components.marketplace.MarketplaceIntegrationService.save',
        'Save on {{host}}',
        { host: hostLabel }
      )}
      disabled={token.trim().length === 0}
      pending={pending}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      {fields.email ? (
        <TextField
          id="integration-email"
          label={translate(
            'auto.components.marketplace.MarketplaceIntegrationService.email',
            'Atlassian email (only with an API token)'
          )}
          value={email}
          onChange={setEmail}
        />
      ) : null}
      <TextField
        id="integration-token"
        type="password"
        label={fields.tokenLabel}
        value={token}
        onChange={setToken}
      />
      <TextField
        id="integration-address"
        type="url"
        label={fields.address}
        value={address}
        onChange={setAddress}
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationService.example',
          'For example {{url}}',
          { url: fields.addressHint }
        )}
      </p>
    </MarketplaceFormDialog>
  )
}
