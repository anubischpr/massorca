import type React from 'react'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { getCompactAgentPrimary } from './worktree-card-compact-agent-row'
import { OneLineSessionMenu } from './worktree-card-one-line-session-menu'

/** A card agent row's own right-click menu; without it the click fell through to the worktree menu. */
export function AgentRowSessionMenu({
  agent,
  children
}: {
  agent: DashboardAgentRow
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <OneLineSessionMenu agent={agent} title={() => getCompactAgentPrimary(agent, null)}>
      <div className="min-w-0">{children}</div>
    </OneLineSessionMenu>
  )
}
