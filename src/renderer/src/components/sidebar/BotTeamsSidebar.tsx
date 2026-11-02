import { Brain, Files, Folder, LayoutGrid, Plus, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import type { BotTeamsSelection } from '@/store/slices/ui/ui-slice-contract-core'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { botTeamBoardColumn } from '../../../../shared/bot-team-board-column'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { useTeamWork } from '../bot-teams/use-bot-team-work'
import { useBotTeamSessionStatuses } from '../bot-teams/use-bot-team-task-status'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { SidebarSearchRow } from './SidebarSearchRow'

const ROW_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors'
const ROW_IDLE_CLASS = 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
const ROW_ACTIVE_CLASS = 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'

function SidebarRow({
  active = false,
  indented = false,
  onClick,
  children
}: {
  active?: boolean
  indented?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(ROW_CLASS, indented && 'pl-8', active ? ROW_ACTIVE_CLASS : ROW_IDLE_CLASS)}
    >
      {children}
    </button>
  )
}

function RowMeta({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-xs text-worktree-sidebar-foreground/45">{children}</span>
}

/** The open team's rows, in the order of the design: room, board, projects, New project. */
function OpenTeamRows({
  teamId,
  selection,
  onPage
}: {
  teamId: string
  selection: BotTeamsSelection
  onPage: boolean
}): React.JSX.Element {
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const { section } = selection
  // Relists when the page moves, so a project made or a task started shows without a reload.
  const { tasks, projects } = useTeamWork(
    teamId,
    `${section?.kind ?? 'room'}:${selection.taskId ?? ''}`
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
          {tasks.length > 0
            ? translate('components.botTeams.taskCount', '{{count}} tasks', {
                count: tasks.length
              })
            : translate('components.botTeams.noTasks', 'No tasks')}
        </RowMeta>
      </SidebarRow>
      <p className="px-2 pt-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-worktree-sidebar-foreground/45">
        {translate('components.botTeams.projects', 'Projects')}
      </p>
      {projects.map((project) => (
        <SidebarRow
          key={project.id}
          indented
          active={
            onPage &&
            selection.taskId === null &&
            section?.kind === 'project' &&
            section.projectId === project.id
          }
          onClick={() =>
            openBotTeamsView({ teamId, section: { kind: 'project', projectId: project.id } })
          }
        >
          <Folder className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
        </SidebarRow>
      ))}
      <SidebarRow
        indented
        active={onPage && selection.taskId === null && section?.kind === 'new-project'}
        onClick={() => openBotTeamsView({ teamId, section: { kind: 'new-project' } })}
      >
        <Plus className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
        <span className="flex-1">{translate('components.botTeams.newProject', 'New project')}</span>
      </SidebarRow>
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
                <OpenTeamRows teamId={team.id} selection={selection} onPage={onPage} />
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
