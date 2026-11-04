import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import StatusIndicator, { type Status } from '@/components/sidebar/StatusIndicator'
import {
  runtimeHostConnectionStateForEntry,
  type RuntimeHostConnectionState
} from '@/runtime/runtime-host-connection-state'
import type { AppState } from '@/store/types'

const COMPACT_TRIGGER_CLASS = 'max-w-40'

type RuntimeHostSelectProps = {
  id?: string
  ariaLabel: string
  value: string
  /** The value that stands for this computer; every other value is a paired server's environment id. */
  localValue: string
  onValueChange: (host: string) => void
  environments: readonly { id: string; name: string }[]
  statuses: AppState['runtimeStatusByEnvironmentId']
  /** Header-sized trigger that shows only the status dot and the host name. */
  compact?: boolean
}

export function runtimeHostGlyph(state: RuntimeHostConnectionState): Status {
  return state === 'connected' ? 'active' : 'inactive'
}

/** Never "stopped": losing contact says nothing about what the work on that host is doing. */
export function runtimeHostStateLabel(state: RuntimeHostConnectionState): string {
  switch (state) {
    case 'connected':
      return translate('components.botTeams.hostConnected', 'Connected')
    case 'checking':
    case 'reconnecting':
      return translate('components.botTeams.hostChecking', 'Checking')
    case 'runtime-unavailable':
    case 'workspace-window-closed':
    case 'disconnected':
      return translate('components.botTeams.hostNotReachable', 'Not reachable')
  }
}

/** One choice per paired server, then This computer; the same rows wherever a host is picked. */
export function RuntimeHostSelect({
  id,
  ariaLabel,
  value,
  localValue,
  onValueChange,
  environments,
  statuses,
  compact = false
}: RuntimeHostSelectProps): React.JSX.Element {
  const selected = environments.find((environment) => environment.id === value)
  const selectedState = selected
    ? runtimeHostConnectionStateForEntry(statuses.get(selected.id))
    : null
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        size="sm"
        aria-label={ariaLabel}
        className={compact ? COMPACT_TRIGGER_CLASS : undefined}
      >
        {compact ? (
          <SelectValue>
            <StatusIndicator
              status={selectedState ? runtimeHostGlyph(selectedState) : 'active'}
              showTooltip={false}
            />
            {selected?.name ?? translate('components.botTeams.thisComputer', 'This computer')}
          </SelectValue>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        {environments.map((environment) => {
          const state = runtimeHostConnectionStateForEntry(statuses.get(environment.id))
          return (
            <SelectItem key={environment.id} value={environment.id}>
              <StatusIndicator status={runtimeHostGlyph(state)} showTooltip={false} />
              {environment.name}
              <span className="text-xs text-muted-foreground">{runtimeHostStateLabel(state)}</span>
            </SelectItem>
          )
        })}
        <SelectItem value={localValue}>
          <StatusIndicator status="active" showTooltip={false} />
          {translate('components.botTeams.thisComputer', 'This computer')}
          <span className="text-xs text-muted-foreground">
            {translate('components.botTeams.hostHere', 'Here')}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
