import {
  BookOpen,
  Files,
  LayoutGrid,
  Plus,
  ShieldAlert,
  UserCheck,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
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

function PendingRow({ icon: Icon, label }: { icon: LucideIcon; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      disabled
      className={cn(ROW_CLASS, 'pl-8 text-worktree-sidebar-foreground/60 disabled:opacity-50')}
    >
      <Icon className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
      <span className="flex-1">{label}</span>
    </button>
  )
}

/** Rows of an open team whose screens are still being built; each turns on with its screen. */
function PendingTeamRows(): React.JSX.Element {
  return (
    <>
      <PendingRow icon={LayoutGrid} label={translate('components.botTeams.board', 'Board')} />
      <div className="px-8 pt-2 pb-0.5 text-[10px] font-semibold tracking-wider text-worktree-sidebar-foreground/45 uppercase">
        {translate('components.botTeams.projects', 'Projects')}
      </div>
      <PendingRow icon={Plus} label={translate('components.botTeams.newProject', 'New project')} />
      <PendingRow icon={Files} label={translate('components.botTeams.files', 'Files')} />
      <PendingRow icon={BookOpen} label={translate('components.botTeams.memory', 'Memory')} />
      <PendingRow
        icon={ShieldAlert}
        label={translate('components.botTeams.permissions', 'Permissions')}
      />
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
                <>
                  <SidebarRow
                    indented
                    active={onPage && selection.taskId === null}
                    onClick={() => openBotTeamsView({ teamId: team.id })}
                  >
                    <UserCheck className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
                    <span className="flex-1">
                      {translate('components.botTeams.conferenceRoom', 'Conference room')}
                    </span>
                  </SidebarRow>
                  <PendingTeamRows />
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
