import type { DelegatedChild, DelegatedChildStatus } from '../../../../shared/delegated-children'
import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog'

export function delegatedAgentLabel(agent: string): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

/** Whole minutes as the chat words them; null when the child never reported a duration. */
export function delegatedDurationText(durationMs: number | null): string | null {
  if (durationMs === null) {
    return null
  }
  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 1) {
    return translate('components.native-chat.delegation.underAMinute', 'under 1 min')
  }
  if (minutes < 60) {
    return translate('components.native-chat.delegation.minutes', '{{minutes}} min', { minutes })
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) {
    return translate('components.native-chat.delegation.hours', '{{hours}} h', { hours })
  }
  return translate(
    'components.native-chat.delegation.hoursMinutes',
    '{{hours}} h {{minutes}} min',
    {
      hours,
      minutes: rest
    }
  )
}

/** The child's row text in the background popover: its agent, then its status and how long it ran. */
export function delegatedChildStatusText(child: DelegatedChild, now: number): string {
  const agent = child.agent === null ? null : delegatedAgentLabel(child.agent)
  const elapsed =
    child.status === 'working'
      ? child.startedAt === null
        ? null
        : delegatedDurationText(Math.max(0, now - child.startedAt))
      : delegatedDurationText(child.durationMs)
  const status = delegatedChildStatusWord(child.status)
  return [agent, elapsed === null ? status : `${status} · ${elapsed}`]
    .filter((part): part is string => part !== null)
    .join(' · ')
}

function delegatedChildStatusWord(status: DelegatedChildStatus): string {
  switch (status) {
    case 'working':
      return translate('components.nativeChatBackground.childStatus.working', 'working')
    case 'succeeded':
      return translate('components.nativeChatBackground.childStatus.succeeded', 'finished')
    case 'failed':
      return translate('components.nativeChatBackground.childStatus.failed', 'failed')
    case 'not-started':
      return translate('components.nativeChatBackground.childStatus.notStarted', 'did not start')
  }
}
