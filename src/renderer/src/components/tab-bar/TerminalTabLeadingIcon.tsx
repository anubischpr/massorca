import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentIcon } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { TerminalAgent } from '../../../../shared/terminal-agent'
import type { PiRuntimeSelection } from '../../../../shared/pi-runtime-selection'
import { FilledBellIcon } from '../sidebar/WorktreeCardHelpers'
import { ShellIcon } from './shell-icons'
import {
  terminalTabActivityToAgentDotState,
  type TerminalTabActivityStatus
} from './terminal-tab-activity-status'
import { translate } from '@/i18n/i18n'

type TerminalTabLeadingIconProps = {
  agent: TerminalAgent | null
  activityStatus: TerminalTabActivityStatus
  shell: TerminalTab['shellOverride']
  showUnreadActivity: boolean
  isActive: boolean
  /** The Pi runtime this tab's chat recorded, when the tab is a structured chat. */
  chatPiRuntime?: PiRuntimeSelection
}

type TerminalTabAgentIdentityIconProps = {
  agent: TerminalAgent
  isActive: boolean
  className?: string
  chatPiRuntime?: PiRuntimeSelection
}

/** Keep the provider glyph treatment identical across every terminal-tab state. */
function TerminalTabAgentIdentityIcon({
  agent,
  isActive,
  className,
  chatPiRuntime
}: TerminalTabAgentIdentityIconProps): React.JSX.Element {
  return (
    <span
      className={cn('inline-flex', !isActive && 'opacity-70', className)}
      data-agent-icon={agent}
      aria-hidden
    >
      <AgentIcon agent={agent} size={12} chatPiRuntime={chatPiRuntime} />
    </span>
  )
}

/** Render a terminal tab's current state without hiding its agent or shell identity. */
export function TerminalTabLeadingIcon({
  agent,
  activityStatus,
  shell,
  showUnreadActivity,
  isActive,
  chatPiRuntime
}: TerminalTabLeadingIconProps): React.JSX.Element {
  if (showUnreadActivity) {
    return (
      <span
        data-testid="tab-activity-bell"
        aria-label={translate(
          'auto.components.tab.bar.TerminalTabLeadingIcon.7ab2964bea',
          'Unread agent completion'
        )}
        className="mr-1 inline-flex shrink-0 items-center gap-1"
      >
        <FilledBellIcon className="size-3 text-amber-500 drop-shadow-sm" />
        {agent ? (
          <TerminalTabAgentIdentityIcon
            agent={agent}
            isActive={isActive}
            chatPiRuntime={chatPiRuntime}
          />
        ) : null}
      </span>
    )
  }

  // Why: shared mapper with Cmd+J recent badges — working/permission/done only; active/inactive
  // fall through to agent/shell identity.
  const dotState = terminalTabActivityToAgentDotState(activityStatus)
  if (dotState) {
    return (
      <span
        data-testid="tab-agent-activity-indicator"
        data-agent-activity-status={activityStatus}
        className="mr-1 inline-flex shrink-0 items-center gap-1"
      >
        {/* Why: the state glyph is self-describing and the tab title already has a tooltip; hover here stays quiet. */}
        <AgentStateDot state={dotState} size="md" title={null} />
        {/* Why: status and identity answer different questions. Keep the agent
            logo beside the state glyph so parallel tabs remain scannable. */}
        {agent ? (
          <TerminalTabAgentIdentityIcon
            agent={agent}
            isActive={isActive}
            chatPiRuntime={chatPiRuntime}
          />
        ) : null}
      </span>
    )
  }

  if (agent) {
    return (
      <TerminalTabAgentIdentityIcon
        agent={agent}
        isActive={isActive}
        className="mr-1 shrink-0"
        chatPiRuntime={chatPiRuntime}
      />
    )
  }

  // Why: ShellIcon renders a colored brand-style tile for PowerShell, CMD,
  // Git Bash, and WSL while retaining the generic terminal fallback elsewhere.
  return (
    <span
      className={`mr-1 inline-flex shrink-0 ${isActive ? '' : 'opacity-70'}`}
      data-shell-icon={shell ?? 'generic'}
      aria-hidden
    >
      <ShellIcon shell={shell} size={12} />
    </span>
  )
}
