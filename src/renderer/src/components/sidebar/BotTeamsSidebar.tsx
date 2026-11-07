import { Brain, CalendarClock, Files, LayoutGrid, Plus, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import type { BotTeamsSelection } from '@/store/slices/ui/ui-slice-contract-core'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { translate } from '@/i18n/i18n'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { BotTeamWaitingMark } from '../bot-teams/BotTeamRoomQuestionMark'
import { useBotTeamAttention } from '../bot-teams/use-bot-team-attention'
import { useBotTeamSessionStatuses } from '../bot-teams/use-bot-team-task-status'
import { useBotTeamUnreadFileCount } from '../bot-teams/use-bot-team-unread-files'
import { useOpenBotTeamTaskCount } from '../bot-teams/use-open-bot-team-task-count'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { BotTeamsSidebarProjects } from './BotTeamsSidebarProjects'
import { RowMeta, SidebarRow } from './BotTeamsSidebarProjectsRow'
import { SidebarSearchRow } from './SidebarSearchRow'
import { useOpenTeamCounts } from './use-bot-team-sidebar-counts'

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
  const { known, tasks, projects, projectTasks, sharedProjects } = useOpenTeamCounts(
    teamId,
    `${section?.kind ?? 'room'}:${selection.taskId ?? ''}:${changes}`
  )
  const statuses = useBotTeamSessionStatuses()
  // Null while a started task's status is unknown; the count then stays hidden, see the hook.
  const open = useOpenBotTeamTaskCount(tasks, statuses)
  const unreadFiles = useBotTeamUnreadFileCount(teamId)
  const waiting = tasks.some(
    (task) =>
      task.sessionId !== null &&
      botTeamTaskStatus(
        task.sessionId,
        statuses.get(task.sessionId),
        task.awaitingPerson === true
      ) === 'Waiting for you'
  )
  const inRoom = onPage && selection.taskId === null && !section
  return (
    <>
      <SidebarRow indented active={inRoom} onClick={() => openBotTeamsView({ teamId })}>
        <UserCheck className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">
          {translate('components.botTeams.conferenceRoom', 'Conference room')}
        </span>
        {waiting ? <BotTeamWaitingMark /> : null}
        {known && open !== null ? (
          <RowMeta>
            {open > 0
              ? translate('components.botTeams.openCount', '{{count}} open', { count: open })
              : translate('components.botTeams.nothingOpen', 'Nothing open')}
          </RowMeta>
        ) : null}
      </SidebarRow>
      <SidebarRow
        indented
        active={onPage && selection.taskId === null && section?.kind === 'board'}
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'board' } })}
      >
        <LayoutGrid className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.board', 'Board')}</span>
        {known ? (
          <RowMeta>
            {tasks.length === 0
              ? translate('components.botTeams.noTasks', 'No tasks')
              : tasks.length === 1
                ? translate('components.botTeams.taskCount_one', '{{count}} task', { count: 1 })
                : translate('components.botTeams.taskCount_other', '{{count}} tasks', {
                    count: tasks.length
                  })}
          </RowMeta>
        ) : null}
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
        {unreadFiles > 0 ? (
          <span
            role="img"
            aria-label={translate('components.botTeams.unreadFiles', '{{count}} new files', {
              count: unreadFiles
            })}
            className="size-2 shrink-0 rounded-full bg-primary"
          />
        ) : null}
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
  const waitingTeam = useBotTeamAttention(teams ?? [])

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
                {waitingTeam(team.id) ? <BotTeamWaitingMark /> : null}
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
