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
import { useAppStore } from '@/store'

// A purchased server arrives as one more paired environment, so it needs no case of its own here.
function HostSelect({ id }: { id?: string }): React.JSX.Element {
  const host = useBotTeamHost()
  const choose = useBotTeamHostStore((state) => state.choose)
  const environments = useAppStore((state) => state.runtimeEnvironments)
  return (
    <Select value={host} onValueChange={choose}>
      <SelectTrigger id={id} size="sm" aria-label={translate('components.botTeams.host', 'Host')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environments.map((environment) => (
          <SelectItem key={environment.id} value={environment.id}>
            {environment.name}
          </SelectItem>
        ))}
        <SelectItem value={BOT_TEAM_LOCAL_HOST}>
          {translate('components.botTeams.thisComputer', 'This computer')}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

/** Which host's teams this window shows; only there when a server is paired, so there is a choice. */
export function BotTeamHostPicker(): React.JSX.Element | null {
  const environments = useAppStore((state) => state.runtimeEnvironments)
  if (environments.length === 0) {
    return null
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl justify-end px-6 pt-4">
      <HostSelect />
    </div>
  )
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
