import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useRightSidebarPageTarget } from '../../app-shell/right-sidebar-page-slot'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import NativeChatView from '@/components/native-chat/NativeChatView'
import { botTeamHostTarget, useBotTeamHost } from '@/runtime/bot-team-host'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamRoom,
  postBotTeamRequest,
  setBotTeamTaskProject,
  startBotTeamTask
} from '@/runtime/runtime-bot-team-client'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../shared/bot-team-greeting'
import { botTeamTaskStatus, type BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamAllAuthor } from './BotTeamAllAuthor'
import { BotTeamRoomComposer } from './BotTeamRoomComposer'
import { BotTeamRoomSidePanel } from './BotTeamRoomSidePanel'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

const NO_PROJECT = 'none'

/** A task's thread: the normal chat, which already holds the composer, Stop and Continue. */
function BotTeamTaskThread({
  task,
  agent,
  onBack
}: {
  task: BotTeamTask
  agent: BotTeam['bots'][number]['agent']
  onBack: () => void
}): React.JSX.Element | null {
  const host = useBotTeamHost()
  const target = useMemo(() => botTeamHostTarget(host), [host])
  if (task.sessionId === null) {
    return null
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate('components.botTeams.backToRoom', 'Back to Conference room')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</h2>
      </div>
      <div className="min-h-0 flex-1">
        <NativeChatView
          mode="structured"
          tabId={structuredAgentSessionTabId(task.sessionId)}
          sessionId={task.sessionId}
          agent={agent}
          isVisible
          isFocusedGroup
          target={target}
        />
      </div>
    </div>
  )
}

const ROOM_CHECK_MS = 5_000

export function BotTeamRoom({
  team,
  openTaskId,
  onOpenTask,
  offline,
  header
}: {
  /** The bar over the conversation; the side panel runs past it to the top. */
  header?: React.ReactNode
  team: BotTeam
  /** The host stopped answering: nothing can be sent, and what is shown may be out of date. */
  offline: boolean
  openTaskId: string | null
  onOpenTask: (taskId: string | null) => void
}): React.JSX.Element {
  const [messages, setMessages] = useState<BotTeamMessage[]>([])
  const [tasks, setTasks] = useState<BotTeamTask[]>([])
  const [projects, setProjects] = useState<BotTeamProject[]>([])
  const [needsLead, setNeedsLead] = useState(false)
  const sidePanel = useRightSidebarPageTarget()
  const statuses = useBotTeamSessionStatuses()
  const botOf = (botId: string | null) => team.bots.find((bot) => bot.id === botId)

  const latestRead = useRef(0)
  const sending = useRef(false)
  const reload = useCallback(() => {
    const read = ++latestRead.current
    void listBotTeamRoom(team.id).then(
      (room) => {
        // An older answer must not undo a newer one.
        if (read === latestRead.current) {
          setMessages(room.messages)
          setTasks(room.tasks)
          setProjects(room.projects ?? [])
        }
      },
      (error: unknown) => {
        if (read === latestRead.current) {
          toast.error(String(error))
        }
      }
    )
  }, [team.id])

  useEffect(reload, [reload])
  // Catches up on what happened while the host was out of reach.
  useEffect(() => {
    if (offline) {
      return
    }
    reload()
    // Bots post and add tasks on their own; the host has no push for the room.
    const timer = window.setInterval(reload, ROOM_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [offline, reload])

  const send = async (text: string): Promise<boolean> => {
    if (sending.current) {
      return false
    }
    sending.current = true
    try {
      const sent = await postBotTeamRequest({ teamId: team.id, text, start: true })
      setNeedsLead(sent.task === null && !sent.greeted)
      if (sent.startError) {
        toast.error(sent.startError)
      }
      reload()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      sending.current = false
    }
  }

  const startTask = async (taskId: string): Promise<void> => {
    try {
      await startBotTeamTask(taskId)
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const moveTask = async (taskId: string, next: string): Promise<void> => {
    try {
      await setBotTeamTaskProject(taskId, next === NO_PROJECT ? null : next)
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const openTask = tasks.find((task) => task.id === openTaskId)
  const openAgent = botOf(openTask?.ownerBotId ?? null)?.agent
  if (openTask && openAgent) {
    return <BotTeamTaskThread task={openTask} agent={openAgent} onBack={() => onOpenTask(null)} />
  }

  const statusOf = (task: BotTeamTask): BotTeamTaskStatus =>
    botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
  const taskCard = (task: BotTeamTask): React.JSX.Element => {
    const owner = botOf(task.ownerBotId)
    return (
      <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
        <BotAgentIcon agent={owner?.agent} size={20} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{task.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {owner?.name}
            {owner?.job ? `, ${owner.job}` : ''}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <StatusIndicator status={botTeamTaskGlyph(statusOf(task))} showTooltip={false} />
          {botTeamTaskLabel(
            botTeamTaskStatus(
              task.sessionId,
              task.sessionId === null ? undefined : statuses.get(task.sessionId)
            )
          )}
          {offline && task.sessionId !== null
            ? translate('components.botTeams.cannotConfirm', ', can’t confirm now')
            : ''}
        </span>
        {projects.length > 0 ? (
          <Select
            value={task.projectId ?? NO_PROJECT}
            disabled={offline}
            onValueChange={(next) => void moveTask(task.id, next)}
          >
            <SelectTrigger
              size="sm"
              aria-label={translate('components.botTeams.projectForTask', 'Project for this task')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT}>
                {translate('components.botTeams.noProject', 'No project')}
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {task.sessionId === null ? (
          <Button
            variant="outline"
            size="sm"
            disabled={offline}
            onClick={() => void startTask(task.id)}
          >
            <Play className="size-3.5" />
            {translate('components.botTeams.start', 'Start')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={offline}
            onClick={() => onOpenTask(task.id)}
          >
            {translate('components.botTeams.open', 'Open')}
          </Button>
        )}
      </div>
    )
  }
  // A task sits under the request that made it; the rest follow the conversation.
  const requestOf = (task: BotTeamTask): BotTeamMessage | undefined =>
    messages.find((message) => message.authorBotId === null && message.text === task.prompt)

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header}
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-6">
            {messages.length === 0 && tasks.length === 0 ? (
              <div className="py-12 text-center">
                <h2 className="text-lg font-semibold">
                  {translate('components.botTeams.askTeam', 'Ask {{team}} for something', {
                    team: team.name
                  })}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'components.botTeams.askTeamHelp',
                    'Each request becomes one or more tasks.'
                  )}
                </p>
              </div>
            ) : null}
            {messages.map((message) => {
              const author = botOf(message.authorBotId)
              const fromAll = message.authorBotId === BOT_TEAM_ALL_AUTHOR
              return (
                <div key={message.id} className="flex flex-col gap-3">
                  {author ? (
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <BotAgentIcon agent={author.agent} size={16} />
                      {author.name}
                    </div>
                  ) : null}
                  {fromAll ? <BotTeamAllAuthor bots={team.bots} /> : null}
                  <div
                    className={
                      author || fromAll
                        ? 'whitespace-pre-wrap text-sm leading-relaxed text-foreground/80'
                        : 'max-w-[80%] self-end whitespace-pre-wrap rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed'
                    }
                  >
                    {message.text}
                  </div>
                  {tasks.filter((task) => requestOf(task)?.id === message.id).map(taskCard)}
                </div>
              )
            })}
            {tasks.filter((task) => requestOf(task) === undefined).map(taskCard)}
            {needsLead ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'components.botTeams.whoTakesIt',
                  'Who should take this? Mention a bot with @ and its name.'
                )}
              </p>
            ) : null}
          </div>
        </div>
        <BotTeamRoomComposer team={team} offline={offline} onSend={send} />
      </div>
      {sidePanel
        ? createPortal(
            <BotTeamRoomSidePanel
              team={team}
              tasks={tasks}
              offline={offline}
              statusOf={statusOf}
              onOpenTask={onOpenTask}
            />,
            sidePanel
          )
        : null}
    </div>
  )
}
