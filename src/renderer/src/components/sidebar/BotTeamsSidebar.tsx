import { Brain, CalendarClock, Files, LayoutGrid, Plus, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import type { BotTeamsSelection } from '@/store/slices/ui/ui-slice-contract-core'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { translate } from '@/i18n/i18n'
import { botTeamBoardColumn } from '../../../../shared/bot-team-board-column'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { useTeamProjectWork } from '../bot-teams/BotTeamProjectTeamsWork'
import { useBotTeamSessionStatuses } from '../bot-teams/use-bot-team-task-status'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { BotTeamsSidebarProjects } from './BotTeamsSidebarProjects'
import { RowMeta, SidebarRow } from './BotTeamsSidebarProjectsRow'
import { SidebarSearchRow } from './SidebarSearchRow'

/** The open team's rows, in the order of the design: room, board, projects. */
function OpenTeamRows({
  team,
  teams,
  selection,
  onPage
}: {
  team: BotTeam
  teams: readonly BotTeam[]
  selection: BotTeamsSelection
  onPage: boolean
}): React.JSX.Element {
  const teamId = team.id
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const { section } = selection
  const [changes, setChanges] = useState(0)
  // Relists when the page moves, so a project made or a task started shows without a reload.
  const { tasks, projects, projectTasks, sharedProjects } = useTeamProjectWork(
    teamId,
    `${section?.kind ?? 'room'}:${selection.taskId ?? ''}:${changes}`
  )
  const statuses = useBotTeamSessionStatuses()
  const open = tasks.filter(
    (task) =>
      botTeamBoardColumn(
        botTeamTaskStatus(
          task.sessionId,
          task.sessionId === null ? undefined : statuses.get(task.sessionId)
        )
      ) !== 'Done'
  ).length
  const inRoom = onPage && selection.taskId === null && !section
  return (
    <>
      <SidebarRow indented active={inRoom} onClick={() => openBotTeamsView({ teamId })}>
        <UserCheck className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">
          {translate('components.botTeams.conferenceRoom', 'Conference room')}
        </span>
        <RowMeta>
          {open > 0
            ? translate('components.botTeams.openCount', '{{count}} open', { count: open })
            : translate('components.botTeams.nothingOpen', 'Nothing open')}
        </RowMeta>
      </SidebarRow>
      <SidebarRow
        indented
        active={onPage && selection.taskId === null && section?.kind === 'board'}
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'board' } })}
      >
        <LayoutGrid className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.board', 'Board')}</span>
        <RowMeta>
          {tasks.length === 0
            ? translate('components.botTeams.noTasks', 'No tasks')
            : tasks.length === 1
              ? translate('components.botTeams.taskCount_one', '{{count}} task', { count: 1 })
              : translate('components.botTeams.taskCount_other', '{{count}} tasks', {
                  count: tasks.length
                })}
        </RowMeta>
      </SidebarRow>
      <BotTeamsSidebarProjects
        team={team}
        teams={teams}
        projects={projects}
        tasks={[...tasks, ...projectTasks]}
        sharedProjects={sharedProjects}
        selection={selection}
        onPage={onPage}
        onOpen={(projectId) =>
          openBotTeamsView({ teamId, section: { kind: 'project', projectId } })
        }
        onNewProject={() => openBotTeamsView({ teamId, section: { kind: 'new-project' } })}
        onLeaveProject={() => openBotTeamsView({ teamId })}
        onChanged={() => setChanges((current) => current + 1)}
      />
      <SidebarRow
        indented
        active={onPage && selection.taskId === null && section?.kind === 'files'}
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'files' } })}
      >
        <Files className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.files', 'Files')}</span>
      </SidebarRow>
      <SidebarRow
        indented
        active={onPage && selection.taskId === null && section?.kind === 'memory'}
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'memory' } })}
      >
        <Brain className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.memory', 'Memory')}</span>
      </SidebarRow>
      <SidebarRow
        indented
        active={
          onPage &&
          selection.taskId === null &&
          (section?.kind === 'routines' ||
            section?.kind === 'routine-new' ||
            section?.kind === 'webhook' ||
            section?.kind === 'routine')
        }
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'routines' } })}
      >
        <CalendarClock className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.routines', 'Routines')}</span>
      </SidebarRow>
    </>
  )
}

/** The left sidebar in Bot teams mode: Search, All teams, then the teams, the open one with its rows. */
export function BotTeamsSidebar(): React.JSX.Element {
  useTranslation()
  const activeView = useAppStore((s) => s.activeView)
  const selection = useAppStore((s) => s.botTeamsSelection)
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const { teams } = useBotTeams()

  const onPage = activeView === 'bot-teams'
  const allTeamsActive = onPage && selection.teamId === null && !selection.creating
  const noTeams = teams !== null && teams.length === 0

  return (
    <nav
      aria-label={translate('components.botTeams.sidebarAria', 'Bot teams')}
      data-bot-teams-sidebar="true"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <SidebarSearchRow />
        <SidebarRow active={allTeamsActive} onClick={() => openBotTeamsView()}>
          <LayoutGrid className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
          <span className="flex-1">{translate('components.botTeams.allTeams', 'All teams')}</span>
        </SidebarRow>
      </div>
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {noTeams ? (
          <SidebarRow onClick={() => openBotTeamsView({ creating: true })}>
            <Plus className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
            <span className="flex-1">{translate('components.botTeams.newTeam', 'New team')}</span>
          </SidebarRow>
        ) : null}
        {(teams ?? []).map((team) => {
          const open = selection.teamId === team.id && !selection.creating
          return (
            <div key={team.id} className="flex flex-col gap-0.5">
              <SidebarRow onClick={() => openBotTeamsView({ teamId: team.id })}>
                <BotTeamCharacterIcon character={team.character} size={16} />
                <span className="min-w-0 flex-1 truncate">{team.name}</span>
              </SidebarRow>
              {open ? (
                <OpenTeamRows
                  team={team}
                  teams={teams ?? []}
                  selection={selection}
                  onPage={onPage}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
