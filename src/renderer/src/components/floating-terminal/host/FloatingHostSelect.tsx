import { RuntimeHostSelect } from '@/components/runtime-host/RuntimeHostSelect'
import { translate } from '@/i18n/i18n'
import { FLOATING_HOST_THIS_COMPUTER } from '@/lib/floating-workspace-host'
import type { AppState } from '@/store/types'

/** Where new terminals and chats start in the floating workspace; shown only with a paired host. */
export function FloatingHostSelect({
  value,
  environments,
  statuses,
  onValueChange
}: {
  value: string
  environments: AppState['runtimeEnvironments']
  statuses: AppState['runtimeStatusByEnvironmentId']
  onValueChange: (host: string) => void
}): React.JSX.Element {
  return (
    <RuntimeHostSelect
      ariaLabel={translate('components.floatingWorkspace.hostSelect', 'Where new sessions start')}
      value={value}
      localValue={FLOATING_HOST_THIS_COMPUTER}
      onValueChange={onValueChange}
      environments={environments}
      statuses={statuses}
      compact
    />
  )
}
