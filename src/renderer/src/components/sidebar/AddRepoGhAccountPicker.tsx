import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { translate } from '@/i18n/i18n'
import { ghAccountKey, inferGhAccount } from '../../../../shared/github/gh-account-inference'
import type { useAddRepoGhAccount } from './use-add-repo-gh-account'

type AddRepoGhAccountPickerProps = {
  ghAccount: ReturnType<typeof useAddRepoGhAccount>
  /** Clone URL being typed; shows which account "Automatic" will use. */
  cloneUrl?: string
  disabled?: boolean
}

/** Renders nothing until the host reports at least one bindable gh login. */
export function AddRepoGhAccountPicker({
  ghAccount,
  cloneUrl,
  disabled
}: AddRepoGhAccountPickerProps): React.JSX.Element | null {
  const labelId = useId()
  const { accounts, choice, setChoice } = ghAccount
  if (accounts.length === 0) {
    return null
  }
  const inferred =
    choice === 'auto' && cloneUrl?.trim()
      ? inferGhAccount({ accounts, remoteUrl: cloneUrl })
      : null
  return (
    <div className="space-y-1.5">
      <span id={labelId} className="text-xs text-muted-foreground">
        {translate('auto.components.sidebar.AddRepoGhAccountPicker.label', 'GitHub account')}
      </span>
      <Select value={choice} disabled={disabled} onValueChange={setChoice}>
        <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            {translate(
              'auto.components.sidebar.AddRepoGhAccountPicker.auto',
              'Automatic (from the remote URL)'
            )}
          </SelectItem>
          {accounts.map((account) => (
            <SelectItem key={ghAccountKey(account)} value={ghAccountKey(account)}>
              {`${account.user} @ ${account.host}`}
            </SelectItem>
          ))}
          <SelectItem value="none">
            {translate(
              'auto.components.sidebar.AddRepoGhAccountPicker.none',
              'None (ambient gh login)'
            )}
          </SelectItem>
        </SelectContent>
      </Select>
      {inferred ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.sidebar.AddRepoGhAccountPicker.inferred',
            'Will use {{user}}.',
            { user: inferred.binding.user }
          )}
        </p>
      ) : null}
      {choice === 'auto' && cloneUrl?.trim() && !inferred ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.sidebar.AddRepoGhAccountPicker.lookup',
            'Checks which of your accounts belongs to this owner when you clone; pick one here if the repository is private.'
          )}
        </p>
      ) : null}
    </div>
  )
}
