import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentStateDot } from '@/components/AgentStateDot'
import { activateAgentTabInWorktree } from '@/components/sidebar/worktree-card-agent-activation'
import { useAppStore } from '@/store'
import { deriveApprovalRows } from './tasks-home-approvals'
import type { BotTeamApprovalRow } from './tasks-home-bot-team-approvals'
import { useBotTeamApprovalRows } from './use-bot-team-approval-rows'

function ApprovalListRow({
  title,
  line,
  origin,
  onOpen
}: {
  title: string
  line: string
  origin: string
  onOpen: () => void
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AgentStateDot state="permission" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {line ? <div className="truncate text-xs text-muted-foreground">{line}</div> : null}
      </div>
      <Badge variant="secondary">{origin}</Badge>
      <Button type="button" variant="outline" size="xs" onClick={onOpen}>
        {translate('components.tasksHome.open', 'Open')}
      </Button>
    </li>
  )
}

function botTeamRowLine(row: BotTeamApprovalRow): string {
  return [
    row.teamName,
    row.botName,
    translate('components.botTeams.waitingForYou', 'Waiting for you')
  ]
    .filter(Boolean)
    .join(' · ')
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
  const botTeamRows = useBotTeamApprovalRows()
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const count = rows.length + botTeamRows.length
  if (count === 0) {
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
          {count}
        </Badge>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((row) => (
          <ApprovalListRow
            key={row.paneKey}
            title={row.title}
            line={row.line}
            origin={translate('components.tasksHome.originWorkspaces', 'WorkSpaces')}
            onOpen={() => activateAgentTabInWorktree(row.worktreeId, row.tabId, row.paneKey)}
          />
        ))}
        {botTeamRows.map((row) => (
          <ApprovalListRow
            key={row.taskId}
            title={row.title}
            line={botTeamRowLine(row)}
            origin={translate('components.tasksHome.originBotTeam', 'Bot Team')}
            onOpen={() => openBotTeamsView({ teamId: row.teamId, taskId: row.taskId })}
          />
        ))}
      </ul>
    </section>
  )
}
