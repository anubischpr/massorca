import { translate } from '@/i18n/i18n'
import { VersionRestoreDialog } from '../version-history/VersionRestoreDialog'

/** Asks before a version replaces the file; the current state is saved first either way. */
export function BotTeamRestoreDialog({
  busy,
  onCancel,
  onRestore
}: {
  busy: boolean
  onCancel: () => void
  onRestore: () => void
}): React.JSX.Element {
  return (
    <VersionRestoreDialog
      busy={busy}
      title={translate('components.botTeams.restoreTitle', 'Restore this version?')}
      description={translate(
        'components.botTeams.restoreHelp',
        'The current version stays in the list, so you can go back to it.'
      )}
      cancelLabel={translate('components.botTeams.cancel', 'Cancel')}
      restoreLabel={translate('components.botTeams.restore', 'Restore')}
      onCancel={onCancel}
      onRestore={onRestore}
    />
  )
}
