import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentStateDot } from '@/components/AgentStateDot'
import { activateAgentTabInWorktree } from '@/components/sidebar/worktree-card-agent-activation'
import { useAppStore } from '@/store'
import { deriveApprovalRows, type ApprovalRow } from './tasks-home-approvals'

function ApprovalListRow({ row }: { row: ApprovalRow }): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AgentStateDot state="permission" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.title}</div>
        {row.line ? <div className="truncate text-xs text-muted-foreground">{row.line}</div> : null}
      </div>
      <Badge variant="secondary">{row.agentLabel}</Badge>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => activateAgentTabInWorktree(row.worktreeId, row.tabId, row.paneKey)}
      >
        {translate('components.tasksHome.open', 'Open')}
      </Button>
    </li>
  )
}

/** Sessions waiting on the user. The whole section is omitted while nothing waits. */
export function TasksHomeApprovals(): React.JSX.Element | null {
  const agentStatusByPaneKey = useAppStore((s) => s.agentStatusByPaneKey)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const settings = useAppStore((s) => s.settings)
  const rows = useMemo(
    () =>
      deriveApprovalRows({ agentStatusByPaneKey, tabsByWorktree, unifiedTabsByWorktree, settings }),
    [agentStatusByPaneKey, settings, tabsByWorktree, unifiedTabsByWorktree]
  )
  if (rows.length === 0) {
    return null
  }
  return (
    <section aria-labelledby="tasks-home-approvals-heading">
      <h2
        id="tasks-home-approvals-heading"
        className="mb-2 flex items-center gap-1 text-base font-semibold"
      >
        {translate('components.tasksHome.approvals', 'Needs your approval')}
        <Badge variant="secondary" className="ml-1">
          {rows.length}
        </Badge>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((row) => (
          <ApprovalListRow key={row.paneKey} row={row} />
        ))}
      </ul>
    </section>
  )
}
