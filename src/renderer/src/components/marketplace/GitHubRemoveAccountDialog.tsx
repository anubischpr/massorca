import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { MarketplaceFormDialog } from './MarketplaceFormDialog'

/** Asks before a gh login is removed; a failure stays inside the dialog and success closes it. */
export function GitHubRemoveAccountDialog({
  account,
  onRemove,
  onClose
}: {
  account: GhAuthAccount
  onRemove: (account: GhAuthAccount) => Promise<string | null>
  onClose: () => void
}): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <MarketplaceFormDialog
      title={translate(
        'auto.components.marketplace.GitHubRemoveAccountDialog.title',
        'Remove {{user}} from this computer?',
        { user: account.user }
      )}
      description={translate(
        'auto.components.marketplace.GitHubRemoveAccountDialog.description',
        'MassOrca signs this GitHub login out of the GitHub CLI on this computer. It does not revoke the token on GitHub. Projects set to this account will not reach GitHub until you sign in again.'
      )}
      submitLabel={translate(
        'auto.components.marketplace.GitHubRemoveAccountDialog.remove',
        'Remove'
      )}
      destructive
      pending={pending}
      error={error}
      onSubmit={() => {
        setPending(true)
        setError(null)
        void onRemove(account).then((failure) => {
          setPending(false)
          if (failure) {
            setError(failure)
          } else {
            onClose()
          }
        })
      }}
      onClose={onClose}
    />
  )
}
