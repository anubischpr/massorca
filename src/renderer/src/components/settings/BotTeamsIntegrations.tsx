import { Calendar, FolderOpen, Mail, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

// The names are the board's placeholders for the apps to come; none of them connects yet.
function integrationApps() {
  return [
    {
      id: 'email',
      icon: Mail,
      name: translate('components.botTeams.settings.integrationEmail', 'Email')
    },
    {
      id: 'calendar',
      icon: Calendar,
      name: translate('components.botTeams.settings.integrationCalendar', 'Calendar')
    },
    {
      id: 'shared-drive',
      icon: FolderOpen,
      name: translate('components.botTeams.settings.integrationDrive', 'Shared drive')
    },
    {
      id: 'crm',
      icon: Users,
      name: translate('components.botTeams.settings.integrationCrm', 'CRM')
    }
  ]
}

/** Board 27: the apps a team could be given, as a list. Nothing connects yet. */
export function BotTeamsIntegrations(): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h2 className="pt-2 text-sm font-semibold">
        {translate('components.botTeams.settings.integrations', 'Integrations')}
      </h2>
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.botTeams.settings.integrationsHelp',
          'Connecting an app does not let bots act on their own. Permissions still apply.'
        )}
      </p>
      <div className="flex flex-col rounded-lg border border-border">
        {integrationApps().map(({ id, name, icon: Icon }) => (
          <div
            key={id}
            className="flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
          >
            <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-sm font-medium">{name}</span>
            <Button size="sm" disabled>
              {translate('components.botTeams.settings.connect', 'Connect')}
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.botTeams.settings.integrationsSoon',
          'Connecting apps is not available yet.'
        )}
      </p>
    </div>
  )
}
