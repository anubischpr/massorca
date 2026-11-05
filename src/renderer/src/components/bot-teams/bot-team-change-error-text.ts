import { translate } from '@/i18n/i18n'
import { MARKETPLACE_AGENT_SWITCH_BLOCKED_MESSAGE } from '../../../../shared/marketplace-apps'

const [BLOCKED_BEFORE, BLOCKED_AFTER] = MARKETPLACE_AGENT_SWITCH_BLOCKED_MESSAGE.split('{{items}}')

/** What a failed bot-team change shows; the host's Antigravity refusal is shown in the UI language. */
export function botTeamChangeErrorText(message: string): string {
  const start = message.indexOf(BLOCKED_BEFORE)
  const end = message.lastIndexOf(BLOCKED_AFTER)
  if (start === -1 || end < start + BLOCKED_BEFORE.length) {
    return message
  }
  const items = message.slice(start + BLOCKED_BEFORE.length, end)
  return translate(
    'auto.shared.marketplace-apps.agentSwitchBlocked',
    MARKETPLACE_AGENT_SWITCH_BLOCKED_MESSAGE,
    {
      items
    }
  )
}
