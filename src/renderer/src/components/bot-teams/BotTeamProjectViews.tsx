import { useState } from 'react'
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
  setBotTeamProjectCodeSource
} from '@/runtime/runtime-bot-team-client'
import {
  BOT_TEAM_BOARD_COLUMNS,
  botTeamBoardColumn
} from '../../../../shared/bot-team-board-column'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamCodeSource,
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { CodeSourcePick, ConnectToCodeCard, codeSourceLabel } from './BotTeamCodeSource'
import { BotTeamProjectTabs, type BotTeamProjectTab } from './BotTeamProjectBrief'
import { BotTeamViewHeader as ViewHeader } from './BotTeamViewHeader'
import { useTeamWork } from './use-bot-team-work'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'

const HOST_CANNOT_CONNECT = (): string =>
  translate(
    'components.botTeams.hostCannotConnect',
    'This host cannot connect projects to code yet.'
  )

export function NewBotProjectForm({
  team,
  onCancel,
  onCreated
}: {
  team: BotTeam
  onCancel: () => void
  onCreated: (project: BotTeamProject) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [source, setSource] = useState<BotTeamCodeSource>('repo')
  const trimmedName = name.trim()
  const create = async (): Promise<void> => {
    const codeSource = team.workspacesEnabled ? source : null
    try {
      const project = await createBotTeamProject({
        teamId: team.id,
        name: trimmedName,
        goal: goal.trim(),
        codeSource
      })
      // An older host drops the source it does not know and still creates the project.
      if (codeSource !== null && project.codeSource !== codeSource) {
        toast.error(HOST_CANNOT_CONNECT())
      }
      onCreated(project)
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
          {team.workspacesEnabled ? <CodeSourcePick value={source} onChange={setSource} /> : null}
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
  projectId,
  onBack,
  onTab,
  onOpenTask
}: {
  team: BotTeam
  projectId: string
  onBack: () => void
  onTab: (tab: BotTeamProjectTab) => void
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const [refresh, setRefresh] = useState(0)
  const { tasks, projects } = useTeamWork(team.id, String(refresh))
  const statuses = useBotTeamSessionStatuses()
  const project = projects.find((entry) => entry.id === projectId)
  const connect = async (source: BotTeamCodeSource): Promise<void> => {
    try {
      const done = await setBotTeamProjectCodeSource(projectId, source)
      if (done === 'unavailable') {
        toast.error(HOST_CANNOT_CONNECT())
      } else {
        setRefresh((current) => current + 1)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  const statusOf = (task: BotTeamTask) =>
    botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
  const own = tasks.filter((task) => task.projectId === projectId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={project?.name ?? ''}
        detail={team.name}
        onBack={onBack}
        trailing={<BotTeamProjectTabs value="board" onChange={onTab} />}
      />
      {project?.goal ? (
        <p className="px-4 pt-2.5 text-xs text-muted-foreground">
          {translate('components.botTeams.goalLine', 'Goal: {{goal}}', { goal: project.goal })}
        </p>
      ) : null}
      {project && team.workspacesEnabled && project.codeSource === null ? (
        <ConnectToCodeCard onConnect={connect} />
      ) : null}
      {project && team.workspacesEnabled && project.codeSource !== null ? (
        <p className="px-4 pt-2.5 text-xs text-muted-foreground">
          {translate('components.botTeams.connectedTo', 'Connected to code: {{source}}.', {
            source: codeSourceLabel(project.codeSource)
          })}
        </p>
      ) : null}
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 items-start gap-3 px-4 pb-5 pt-3.5">
          {BOT_TEAM_BOARD_COLUMNS.map((column) => {
            const cards = own.filter((task) => botTeamBoardColumn(statusOf(task)) === column)
            return (
              <div key={column} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="text-[13px] font-semibold">{column}</span>
                  <Badge variant="secondary">{cards.length}</Badge>
                </div>
                {cards.map((task) => {
                  const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
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
                      <span className="text-xs text-muted-foreground">{statusOf(task)}</span>
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

/** Every task of the team, with or without a project. */
export function BotTeamBoard({
  team,
  onBack,
  onOpenTask
}: {
  team: BotTeam
  onBack: () => void
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const { tasks, projects } = useTeamWork(team.id)
  const statuses = useBotTeamSessionStatuses()
  // null: all; 'none': without a project; otherwise a project id.
  const [filter, setFilter] = useState<string | null>(null)
  const shown = tasks.filter((task) =>
    filter === null ? true : filter === 'none' ? task.projectId === null : task.projectId === filter
  )
  const chips = [
    { id: null, name: translate('components.botTeams.allTasks', 'All') },
    ...projects.map((project) => ({ id: project.id, name: project.name })),
    { id: 'none', name: translate('components.botTeams.noProject', 'No project') }
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={translate('components.botTeams.board', 'Board')}
        detail={translate('components.botTeams.boardDetail', '{{team}}, all tasks', {
          team: team.name
        })}
        onBack={onBack}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Button
                key={chip.id ?? 'all'}
                variant={chip.id === filter ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilter(chip.id)}
              >
                {chip.name}
              </Button>
            ))}
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-card">
            {shown.map((task) => {
              const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
              return (
                <button
                  key={task.id}
                  type="button"
                  disabled={task.sessionId === null}
                  onClick={() => onOpenTask(task.id)}
                  className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left first:border-t-0 hover:bg-muted"
                >
                  <AgentIcon agent={owner?.agent} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {owner?.name}
                    </span>
                  </span>
                  {task.projectId ? (
                    <Badge variant="secondary">
                      {projects.find((project) => project.id === task.projectId)?.name}
                    </Badge>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {botTeamTaskStatus(
                      task.sessionId,
                      task.sessionId === null ? undefined : statuses.get(task.sessionId)
                    )}
                  </span>
                </button>
              )
            })}
            {shown.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {translate('components.botTeams.noTasksHere', 'No tasks here.')}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.boardHelp',
              'Every task of this team, including those without a project. Use the chips to filter by project.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
