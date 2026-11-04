import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { BOT_TEAM_LOCAL_HOST, useBotTeamHost, useBotTeamHostStore } from '@/runtime/bot-team-host'
import { RuntimeHostSelect } from '@/components/runtime-host/RuntimeHostSelect'
import { useAppStore } from '@/store'

// A purchased server arrives as one more paired environment, so it needs no case of its own here.
function HostSelect({ id }: { id?: string }): React.JSX.Element {
  const host = useBotTeamHost()
  const choose = useBotTeamHostStore((state) => state.choose)
  const environments = useAppStore((state) => state.runtimeEnvironments)
  const statuses = useAppStore((state) => state.runtimeStatusByEnvironmentId)
  return (
    <RuntimeHostSelect
      id={id}
      ariaLabel={translate('components.botTeams.host', 'Host')}
      value={host}
      localValue={BOT_TEAM_LOCAL_HOST}
      onValueChange={choose}
      environments={environments}
      statuses={statuses}
    />
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
