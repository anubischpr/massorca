import { translate } from '@/i18n/i18n'
import type { DelegationReasonCode } from '../../../../shared/delegated-session-types'

/** The line a reason code reads as, or undefined for one another line already shows. */
export function delegationReasonText(code: DelegationReasonCode): string | undefined {
  switch (code) {
    case 'lowest-usage':
      return translate('components.native-chat.delegation.lowestUsage', 'Lowest usage')
    case 'parent-agent-tie':
      return translate(
        'components.native-chat.delegation.parentAgentTie',
        "Within 5 points of the lowest usage, so the parent's agent wins"
      )
    case 'fixed-order-tie':
      return translate(
        'components.native-chat.delegation.fixedOrderTie',
        'Tied on usage, so the fixed agent order decides'
      )
    case 'high-risk-tier-floor':
      return translate(
        'components.native-chat.delegation.riskFloor',
        'High risk raises the task to tier 4'
      )
    case 'model-unavailable':
      return translate(
        'components.native-chat.delegation.modelUnavailable',
        'This agent has no model for this tier, so its default runs'
      )
    case 'effort-clamped':
      return translate(
        'components.native-chat.delegation.effortClamped',
        'Effort is lowered to what this agent supports'
      )
    case 'read-only-current-worktree':
      return translate(
        'components.native-chat.delegation.readOnly',
        'Read-only task, so it runs in this worktree'
      )
    case 'writes-new-child-worktree':
      return translate(
        'components.native-chat.delegation.writes',
        'Writes code, so it gets its own worktree'
      )
    case 'folder-workspace-writes':
      return translate(
        'components.native-chat.delegation.folderWrites',
        'Folder workspace, so writes land in this folder'
      )
    // Shown by the usage line instead of as a reason.
    case 'no-usage-data':
      return undefined
  }
}
