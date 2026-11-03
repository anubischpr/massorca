import { useState } from 'react'
import { Folder, Plus, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { archiveBotTeamProject } from '@/runtime/runtime-bot-team-project-client'
import { useAppStore } from '@/store'
import type { BotTeamsSelection } from '@/store/slices/ui/ui-slice-contract-core'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { linkedRepoIcon } from '../bot-teams/bot-team-mention-projects'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { BotTeamProjectDeleteDialog } from '../bot-teams/BotTeamProjectDeleteDialog'
import { BotTeamProjectFormEdit } from '../bot-teams/BotTeamProjectFormEdit'
import { BotTeamProjectMenu } from './BotTeamProjectMenu'
import { RowMeta, SidebarRow } from './BotTeamsSidebarProjectsRow'

const HEADER_BUTTON_CLASS = 'text-worktree-sidebar-foreground/60'

/** The Projects heading with its toolbar: Filters and +, the Workspaces header's buttons for teams. */
function ProjectsHeader({
  showArchived,
  onShowArchived,
  onNewProject
}: {
  showArchived: boolean
  onShowArchived: (next: boolean) => void
  onNewProject: () => void
}): React.JSX.Element {
  const filters = translate('components.botTeams.projectFilters', 'Filters')
  const newProject = translate('components.botTeams.newProject', 'New project')
  return (
    <div className="flex items-center gap-0.5 pt-2.5 pb-0.5 pl-2 pr-0.5">
      <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-worktree-sidebar-foreground/45">
        {translate('components.botTeams.projects', 'Projects')}
      </p>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={HEADER_BUTTON_CLASS}
                aria-label={filters}
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {filters}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuCheckboxItem
            checked={showArchived}
            onCheckedChange={(next) => onShowArchived(next === true)}
          >
            {translate('components.botTeams.showArchived', 'Show archived')}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={HEADER_BUTTON_CLASS}
            aria-label={newProject}
            onClick={onNewProject}
          >
            <Plus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {newProject}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/** The open team's projects: heading toolbar, one row each with its right-click menu. */
export function BotTeamsSidebarProjects({
  team,
  teams,
  projects,
  tasks,
  sharedProjects,
  selection,
  onPage,
  onOpen,
  onNewProject,
  onLeaveProject,
  onChanged
}: {
  team: BotTeam
  teams: readonly BotTeam[]
  /** Owned and linked, archived ones included. */
  projects: readonly BotTeamProject[]
  /** Every task of these projects, whichever team filed it. */
  tasks: readonly BotTeamTask[]
  /** False on a host from before shared projects: rows get no menu. */
  sharedProjects: boolean
  selection: BotTeamsSelection
  onPage: boolean
  onOpen: (projectId: string) => void
  onNewProject: () => void
  /** The open project is gone or hidden: go back to the Conference room. */
  onLeaveProject: () => void
  onChanged: () => void
}): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<BotTeamProject | null>(null)
  const [deleting, setDeleting] = useState<BotTeamProject | null>(null)
  const repos = useAppStore((state) => state.repos)
  const { section } = selection
  const shown = projects.filter((project) => showArchived || project.archivedAt == null)
  const openProjectId = section?.kind === 'project' ? section.projectId : null

  const archive = async (project: BotTeamProject): Promise<void> => {
    try {
      const done = await archiveBotTeamProject({
        projectId: project.id,
        teamId: team.id,
        archived: project.archivedAt == null
      })
      if (done === 'unavailable') {
        toast.error(
          translate(
            'components.botTeams.hostCannotArchiveProject',
            'This host cannot archive projects yet.'
          )
        )
        return
      }
      if (done.archivedAt != null && !showArchived && project.id === openProjectId) {
        onLeaveProject()
      }
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <>
      <ProjectsHeader
        showArchived={showArchived}
        onShowArchived={setShowArchived}
        onNewProject={onNewProject}
      />
      {shown.map((project) => {
        const owner = teams.find((entry) => entry.id === project.teamId)
        const icon = linkedRepoIcon(repos, project)
        const linkedHere = project.teamId !== team.id
        const archived = project.archivedAt != null
        const row = (
          <SidebarRow
            indented
            dimmed={archived}
            active={
              onPage &&
              selection.taskId === null &&
              section?.kind === 'project' &&
              section.projectId === project.id
            }
            onClick={() => onOpen(project.id)}
          >
            {icon ? (
              <RepoIconGlyph repoIcon={icon} className="size-4 shrink-0" />
            ) : (
              <Folder className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
            )}
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {archived ? (
              <RowMeta>{translate('components.botTeams.archived', 'Archived')}</RowMeta>
            ) : null}
            {linkedHere && owner ? (
              <span
                role="img"
                aria-label={translate('components.botTeams.ownerMark', 'Owner: {{team}}', {
                  team: owner.name
                })}
                title={translate('components.botTeams.ownerMark', 'Owner: {{team}}', {
                  team: owner.name
                })}
              >
                <BotTeamCharacterIcon character={owner.character} size={14} />
              </span>
            ) : null}
          </SidebarRow>
        )
        return sharedProjects ? (
          <ContextMenu key={project.id}>
            <ContextMenuTrigger asChild>
              <div>{row}</div>
            </ContextMenuTrigger>
            <BotTeamProjectMenu
              ownedByThisTeam={!linkedHere}
              archived={archived}
              onEdit={() => setEditing(project)}
              onLinkTeam={() => setEditing(project)}
              onArchive={() => void archive(project)}
              onDelete={() => setDeleting(project)}
            />
          </ContextMenu>
        ) : (
          <div key={project.id}>{row}</div>
        )
      })}
      {editing ? (
        <BotTeamProjectFormEdit
          project={editing}
          actingTeam={team}
          allTeams={teams}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      ) : null}
      {deleting ? (
        <BotTeamProjectDeleteDialog
          project={deleting}
          teamId={team.id}
          taskCount={tasks.filter((task) => task.projectId === deleting.id).length}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (deleting.id === openProjectId) {
              onLeaveProject()
            }
            onChanged()
          }}
        />
      ) : null}
    </>
  )
}
