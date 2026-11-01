import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { BOT_TEAM_LOCAL_HOST, useBotTeamHost, useBotTeamHostStore } from '@/runtime/bot-team-host'
import { useAppStore } from '@/store'

/** Which host's teams this window shows; only there when a server is paired, so there is a choice. */
export function BotTeamHostPicker(): React.JSX.Element | null {
  const host = useBotTeamHost()
  const choose = useBotTeamHostStore((state) => state.choose)
  const environments = useAppStore((state) => state.runtimeEnvironments)
  if (environments.length === 0) {
    return null
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl justify-end px-6 pt-4">
      <Select value={host} onValueChange={choose}>
        <SelectTrigger size="sm" aria-label={translate('components.botTeams.host', 'Host')}>
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
    </div>
  )
}
