import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { BOT_TEAM_LOCAL_HOST, useBotTeamHost, useBotTeamHostStore } from '@/runtime/bot-team-host'
import {
  runtimeHostConnectionStateForEntry,
  type RuntimeHostConnectionState
} from '@/runtime/runtime-host-connection-state'
import StatusIndicator, { type Status } from '@/components/sidebar/StatusIndicator'
import { useAppStore } from '@/store'

function hostGlyph(state: RuntimeHostConnectionState): Status {
  return state === 'connected' ? 'active' : 'inactive'
}

/** Never "stopped": losing contact says nothing about what the bots on that host are doing. */
function hostStateLabel(state: RuntimeHostConnectionState): string {
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

// A purchased server arrives as one more paired environment, so it needs no case of its own here.
function HostSelect({ id }: { id?: string }): React.JSX.Element {
  const host = useBotTeamHost()
  const choose = useBotTeamHostStore((state) => state.choose)
  const environments = useAppStore((state) => state.runtimeEnvironments)
  const statuses = useAppStore((state) => state.runtimeStatusByEnvironmentId)
  return (
    <Select value={host} onValueChange={choose}>
      <SelectTrigger id={id} size="sm" aria-label={translate('components.botTeams.host', 'Host')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environments.map((environment) => {
          const state = runtimeHostConnectionStateForEntry(statuses.get(environment.id))
          return (
            <SelectItem key={environment.id} value={environment.id}>
              <StatusIndicator status={hostGlyph(state)} showTooltip={false} />
              {environment.name}
              <span className="text-xs text-muted-foreground">{hostStateLabel(state)}</span>
            </SelectItem>
          )
        })}
        <SelectItem value={BOT_TEAM_LOCAL_HOST}>
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

/** Which host's teams All teams shows; only there when a server is paired, so there is a choice. */
export function BotTeamHostPicker(): React.JSX.Element | null {
  const environments = useAppStore((state) => state.runtimeEnvironments)
  return environments.length === 0 ? null : <HostSelect />
}

/** The first step of a new team: where it will live, with what that means for the person. */
export function BotTeamHostField(): React.JSX.Element {
  const host = useBotTeamHost()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="team-host">
        {translate('components.botTeams.whereItRuns', 'Where this team runs')}
      </Label>
      <HostSelect id="team-host" />
      <p className="text-xs text-muted-foreground">
        {host === BOT_TEAM_LOCAL_HOST
          ? translate(
              'components.botTeams.runsHereHelp',
              'This team and its bots run here. They work only while this computer is on, and your phone does not see them.'
            )
          : translate(
              'components.botTeams.runsOnServerHelp',
              'This team and its bots run on this server. Your phone sees it, and work continues when this computer is off.'
            )}
      </p>
    </div>
  )
}
