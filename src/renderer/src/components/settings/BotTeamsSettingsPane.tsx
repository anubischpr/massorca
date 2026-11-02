import { useBotTeams } from '@/components/bot-teams/use-bot-teams'
import { BotTeamCharacterIcon } from '@/components/bot-teams/BotTeamCharacterIcon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import { updateBotTeam } from '@/runtime/runtime-bot-team-client'
import { useAppStore } from '@/store'

export function BotTeamsSettingsPane(): React.JSX.Element {
  const { teams, applyChange } = useBotTeams()
  const animations = useAppStore((state) => state.settings?.botTeamCharacterAnimations !== false)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const animationsRow = (
    <label className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {translate('components.botTeams.settings.animations', 'Character animations')}
        </span>
        <span className="block text-xs text-muted-foreground">
          {translate(
            'components.botTeams.settings.animationsHelp',
            'Off, a still aura shows who is working.'
          )}
        </span>
      </span>
      <Switch
        checked={animations}
        onCheckedChange={(botTeamCharacterAnimations) =>
          void updateSettings({ botTeamCharacterAnimations })
        }
      />
    </label>
  )
  if (teams === null || teams.length === 0) {
    return (
      <div className="space-y-2">
        {animationsRow}
        <p className="text-sm text-muted-foreground">
          {translate('components.botTeams.settings.empty', 'Teams you create appear here.')}
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {animationsRow}
      {teams.map((team) => (
        <div key={team.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <BotTeamCharacterIcon character={team.character} size={24} still />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {translate('components.botTeams.workspaces', 'Workspaces')}
            <Switch
              checked={team.workspacesEnabled}
              onCheckedChange={(workspacesEnabled) =>
                void applyChange(() => updateBotTeam({ teamId: team.id, workspacesEnabled }))
              }
            />
          </label>
          <Select
            value={team.accessMode}
            onValueChange={(next) =>
              void applyChange(() =>
                updateBotTeam({
                  teamId: team.id,
                  accessMode: next === 'default' ? 'default' : 'full-access'
                })
              )
            }
          >
            <SelectTrigger
              size="sm"
              aria-label={translate('components.botTeams.settings.access', 'Access')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-access">
                {translate('components.botTeams.settings.fullAccess', 'Full access')}
              </SelectItem>
              <SelectItem value="default">
                {translate('components.botTeams.settings.askFirst', 'Ask first')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
