import { useBotTeams } from '@/components/bot-teams/use-bot-teams'
import { BotTeamCharacterIcon } from '@/components/bot-teams/BotTeamCharacterIcon'
import { Switch } from '@/components/ui/switch'
import { BotTeamsIntegrations } from './BotTeamsIntegrations'
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
        <BotTeamsIntegrations />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {animationsRow}
      <h2 className="pt-2 text-sm font-semibold">
        {translate('components.botTeams.settings.workspaces', 'Workspaces')}
      </h2>
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.botTeams.settings.workspacesHelp',
          'Per team. Projects can connect to code and be followed in Workspaces. Turning it off hides access and deletes nothing.'
        )}
      </p>
      {teams.map((team) => (
        <div key={team.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <BotTeamCharacterIcon character={team.character} size={24} still />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{team.name}</span>
            <span className="block text-xs text-muted-foreground">
              {team.workspacesEnabled
                ? translate(
                    'components.botTeams.settings.workspacesOn',
                    'Projects can connect to code and be followed in Workspaces.'
                  )
                : translate(
                    'components.botTeams.settings.workspacesOff',
                    'Work stays out of Workspaces.'
                  )}
            </span>
          </span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {translate('components.botTeams.workspaces', 'Workspaces')}
            <Switch
              checked={team.workspacesEnabled}
              onCheckedChange={(workspacesEnabled) =>
                void applyChange(() => updateBotTeam({ teamId: team.id, workspacesEnabled }))
              }
            />
          </label>
        </div>
      ))}
      <BotTeamsIntegrations />
    </div>
  )
}
