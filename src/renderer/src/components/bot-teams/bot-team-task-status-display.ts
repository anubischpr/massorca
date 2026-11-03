import type { Status } from '@/components/sidebar/StatusIndicator'
import { translate } from '@/i18n/i18n'
import type { BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'

export function botTeamTaskGlyph(status: BotTeamTaskStatus): Status {
  if (status === 'Working') {
    return 'working'
  }
  return status === 'Waiting for you' ? 'permission' : 'inactive'
}

export function botTeamTaskLabel(status: BotTeamTaskStatus): string {
  switch (status) {
    case 'Not started':
      return translate('components.botTeams.notStarted', 'Not started')
    case 'Unknown':
      return translate('components.botTeams.checkingStatus', 'Checking status')
    case 'Working':
      return translate('components.botTeams.working', 'Working')
    case 'Waiting for you':
      return translate('components.botTeams.waitingForYou', 'Waiting for you')
    case 'Stopped':
      return translate('components.botTeams.stopped', 'Stopped')
    case 'Stuck':
      return translate('components.botTeams.stuck', 'Stuck')
    case 'Done':
      return translate('components.botTeams.done', 'Done')
  }
}
