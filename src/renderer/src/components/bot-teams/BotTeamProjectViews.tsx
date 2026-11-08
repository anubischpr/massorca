import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import {
  createBotTeamProject,
  setBotTeamProjectCodeSource,
  setBotTeamProjectWorkspace
} from '@/runtime/runtime-bot-team-client'
import {
  BOT_TEAM_BOARD_COLUMNS,
  botTeamBoardColumn
} from '../../../../shared/bot-team-board-column'
import { botTeamTaskPlacement } from '../../../../shared/bot-team-task-status-fallback'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamCodeSource,
  BotTeamProject,
  BotTeamProjectWorkspace,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { CodeSourcePick, ConnectToCodeCard, codeSourceLabel } from './BotTeamCodeSource'
import { BotTeamProjectTabs, type BotTeamProjectTab } from './BotTeamProjectBrief'
import {
  HOST_CANNOT_LINK,
  ProjectWorkspaceLink,
  useLinkableWorkspaces,
  WorkspacesAdvancedOptions
} from './BotTeamProjectWorkspace'
import { BotTeamViewHeader as ViewHeader } from './BotTeamViewHeader'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamProjectTeamsField } from './BotTeamProjectTeamsField'
import { useTeamProjectWork } from './BotTeamProjectTeamsWork'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { BotTeamTaskStatusPlaceholder } from './BotTeamTaskCard'
import { keepSessionStatuses, keptSessionSummary } from './bot-team-project-board-cache'

const HOST_CANNOT_CONNECT = (): string =>
  translate(
    'components.botTeams.hostCannotConnect',
    'This host cannot connect projects to code yet.'
  )

export function NewBotProjectForm({
  team,
  allTeams,
  onCancel,
  onCreated
}: {
  team: BotTeam
  /** Every team on the host, for the Teams field. */
  allTeams?: readonly BotTeam[]
  onCancel: () => void
  onCreated: (project: BotTeamProject) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [source, setSource] = useState<BotTeamCodeSource>('repo')
  const [workspace, setWorkspace] = useState<BotTeamProjectWorkspace | null>(null)
  const [linkedTeamIds, setLinkedTeamIds] = useState<string[]>([])
  const teamsOnHost = allTeams ?? [team]
  const listing = useLinkableWorkspaces(team.id, team.workspacesEnabled)
  const trimmedName = name.trim()
  const create = async (): Promise<void> => {
    const codeSource = team.workspacesEnabled ? source : null
    try {
      const project = await createBotTeamProject({
        teamId: team.id,
        name: trimmedName,
        goal: goal.trim(),
        codeSource,
        ...(linkedTeamIds.length > 0 ? { linkedTeamIds } : {})
      })
      // An older host drops the source it does not know and still creates the project.
      if (codeSource !== null && project.codeSource !== codeSource) {
        toast.error(HOST_CANNOT_CONNECT())
      }
      let created = project
      if (codeSource === 'repo' && workspace !== null) {
        const linked = await setBotTeamProjectWorkspace(project.id, workspace.key)
        if (linked === 'unavailable') {
          toast.error(HOST_CANNOT_LINK())
        } else {
          created = linked
        }
      }
      onCreated(created)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={translate('components.botTeams.newProject', 'New project')}
        detail={team.name}
        onBack={onCancel}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div>
            <h1 className="text-xl font-semibold">
              {translate('components.botTeams.newProject', 'New project')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate(
                'components.botTeams.newProjectHelp',
                'A project holds the why. Its tasks hold the how.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">
              {translate('components.botTeams.projectName', 'Name')}
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-goal">
              {translate('components.botTeams.projectGoal', 'Goal')}
            </Label>
            <Textarea
              id="project-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
          <BotTeamProjectTeamsField
            owner={team}
            linkedTeamIds={linkedTeamIds}
            allTeams={teamsOnHost}
            editing={false}
            onChange={setLinkedTeamIds}
          />
          {team.workspacesEnabled ? <CodeSourcePick value={source} onChange={setSource} /> : null}
          {team.workspacesEnabled && source === 'repo' ? (
            <WorkspacesAdvancedOptions
              listing={listing}
              value={workspace}
              onChange={setWorkspace}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.projectBelongsTo',
              'The project belongs to {{team}}. You can write the brief later.',
              { team: team.name }
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {translate('components.botTeams.cancel', 'Cancel')}
            </Button>
            <Button disabled={trimmedName === ''} onClick={() => void create()}>
              {translate('components.botTeams.createProject', 'Create project')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** One project's tasks in the four columns. */
export function BotTeamProjectBoard({
  team,
  allTeams,
  projectId,
  onBack,
  onTab,
  onOpenTask
}: {
  team: BotTeam
  /** Every team on the host, to name the team and the bot of tasks other teams filed here. */
  allTeams?: readonly BotTeam[]
  projectId: string
  onBack: () => void
  onTab: (tab: BotTeamProjectTab) => void
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const [refresh, setRefresh] = useState(0)
  const { tasks, projects, projectTasks } = useTeamProjectWork(team.id, String(refresh))
  const statuses = useBotTeamSessionStatuses()
  useEffect(() => keepSessionStatuses(statuses), [statuses])
  const project = projects.find((entry) => entry.id === projectId)
  // The owner team's Workspaces setting and workspace link apply to the project.
  const teamsOnHost = allTeams ?? [team]
  const ownerTeam = teamsOnHost.find((entry) => entry.id === project?.teamId) ?? team
  const linkedHere = project !== undefined && project.teamId !== team.id
  const shared = (project?.linkedTeamIds?.length ?? 0) > 0 || linkedHere
  const connect = async (
    source: BotTeamCodeSource,
    workspace: BotTeamProjectWorkspace | null
  ): Promise<void> => {
    try {
      const done = await setBotTeamProjectCodeSource(projectId, source)
      if (done === 'unavailable') {
        toast.error(HOST_CANNOT_CONNECT())
        return
      }
      if (workspace !== null) {
        const linked = await setBotTeamProjectWorkspace(projectId, workspace.key)
        if (linked === 'unavailable') {
          toast.error(HOST_CANNOT_LINK())
        }
      }
      setRefresh((current) => current + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  const placementOf = (task: BotTeamTask) =>
    botTeamTaskPlacement({
      sessionId: task.sessionId,
      live: task.sessionId === null ? undefined : statuses.get(task.sessionId),
      kept: keptSessionSummary(task.sessionId),
      stored: task.lastStatus,
      awaitingPerson: task.awaitingPerson === true
    })
  const own = [...tasks, ...projectTasks].filter((task) => task.projectId === projectId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={project?.name ?? ''}
        detail={team.name}
        onBack={onBack}
        trailing={
          <>
            {linkedHere ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">
                  {translate('components.botTeams.projectOwner', 'Owner:')}
                </span>
                <BotTeamCharacterIcon character={ownerTeam.character} size={16} />
                <span>{ownerTeam.name}</span>
              </span>
            ) : null}
            <BotTeamProjectTabs value="board" onChange={onTab} />
          </>
        }
      />
      {project?.goal ? (
        <p className="px-4 pt-2.5 text-xs text-muted-foreground">
          {translate('components.botTeams.goalLine', 'Goal: {{goal}}', { goal: project.goal })}
        </p>
      ) : null}
      {project && ownerTeam.workspacesEnabled && project.codeSource === null ? (
        <ConnectToCodeCard teamId={ownerTeam.id} onConnect={connect} />
      ) : null}
      {project && ownerTeam.workspacesEnabled && project.codeSource !== null ? (
        <p className="px-4 pt-2.5 text-xs text-muted-foreground">
          {translate('components.botTeams.connectedTo', 'Connected to code: {{source}}.', {
            source: codeSourceLabel(project.codeSource)
          })}
        </p>
      ) : null}
      {project && ownerTeam.workspacesEnabled && project.codeSource === 'repo' ? (
        <ProjectWorkspaceLink
          team={ownerTeam}
          project={project}
          onChanged={() => setRefresh((current) => current + 1)}
        />
      ) : null}
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 items-start gap-3 px-4 pb-5 pt-3.5">
          {BOT_TEAM_BOARD_COLUMNS.map((column) => {
            const cards = own.filter(
              (task) => botTeamBoardColumn(placementOf(task).placedAs) === column
            )
            return (
              <div key={column} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="text-[13px] font-semibold">{column}</span>
                  <Badge variant="secondary">{cards.length}</Badge>
                </div>
                {cards.map((task) => {
                  const taskTeam = teamsOnHost.find((entry) => entry.id === task.teamId) ?? team
                  const owner = taskTeam.bots.find((bot) => bot.id === task.ownerBotId)
                  const placement = placementOf(task)
                  return (
                    <button
                      key={task.id}
                      type="button"
                      disabled={task.sessionId === null}
                      onClick={() => onOpenTask(task.id)}
                      className="flex w-full min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-left"
                    >
                      <span className="text-xs font-medium leading-snug">{task.title}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AgentIcon agent={owner?.agent} size={16} />
                        <span className="truncate">{owner?.name}</span>
                      </span>
                      {shared ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <BotTeamCharacterIcon character={taskTeam.character} size={16} />
                          <span className="truncate">{taskTeam.name}</span>
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {placement.status === 'Unknown' ? (
                          <BotTeamTaskStatusPlaceholder />
                        ) : (
                          placement.status
                        )}
                      </span>
                    </button>
                  )
                })}
                {cards.length === 0 ? (
                  <p className="px-0.5 text-xs text-muted-foreground">
                    {translate('components.botTeams.nothingHere', 'Nothing here yet.')}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { BotTeamBoard } from './BotTeamBoard'
