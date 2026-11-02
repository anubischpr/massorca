import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRightSidebarPageTarget } from '../../app-shell/right-sidebar-page-slot'
import { Button } from '@/components/ui/button'
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
import { BotTeamTypingLine } from './BotTeamTypingLine'
import { botTeamTypingAuthor } from '../../../../shared/bot-team-typing'
import { useBotTeamReplying } from './BotTeamRoomReplying'
import { BotTeamReassignButton } from './BotTeamReassignButton'
import { BotTeamPendingChoice, type BotTeamPendingChoiceRequest } from './BotTeamPendingChoice'
import { BotTeamRoomComposer } from './BotTeamRoomComposer'
import { BotTeamTaskCard } from './BotTeamTaskCard'
import { BotTeamRoomQuestion } from './BotTeamRoomQuestion'
import { BotTeamRoomSidePanel } from './BotTeamRoomSidePanel'
import { placeBotTeamRoomTasks } from '../../../../shared/bot-team-room-order'

const NO_PROJECT = 'none'
const NO_TEAMS: readonly BotTeam[] = []
const IDLE_STATUSES: ReadonlySet<BotTeamTaskStatus> = new Set(['Not started', 'Stopped', 'Stuck'])

/** A task's thread: the normal chat, which already holds the composer, Stop and Continue. */
function BotTeamTaskThread({
  task,
  agent,
  onBack,
  reassign
}: {
  task: BotTeamTask
  agent: BotTeam['bots'][number]['agent']
  onBack: () => void
  /** Reassign, offered while the task is idle. */
  reassign?: React.ReactNode
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
        {reassign}
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
  header,
  otherTeams = NO_TEAMS,
  onCreateBot,
  onCreateTeam
}: {
  /** Teams the room can suggest or send a request to. */
  otherTeams?: readonly BotTeam[]
  onCreateBot?: () => void
  onCreateTeam?: () => void
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
  const [needsOwner, setNeedsOwner] = useState(false)
  const [pending, setPending] = useState<BotTeamPendingChoiceRequest | null>(null)
  // The text with the host, if any; the room shows who is typing until the reply comes back.
  const [typing, setTyping] = useState<string | null>(null)
  const replying = useBotTeamReplying(team.bots)
  const readReplying = replying.readRoom
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
          readReplying(room.replying)
        }
      },
      (error: unknown) => {
        if (read === latestRead.current) {
          toast.error(String(error))
        }
      }
    )
  }, [team.id, readReplying])

  useEffect(reload, [reload])
  // Catches up on what happened while the host was out of reach.
  useEffect(() => {
    if (offline) {
      return
    }
    reload()
    // Bots post and add tasks on their own; the host has no push for the room.
    const timer = window.setInterval(reload, replying.pollMs ?? ROOM_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [offline, reload, replying.pollMs])

  const send = async (text: string): Promise<boolean> => {
    if (sending.current) {
      return false
    }
    sending.current = true
    setTyping(text)
    // Shows the person's line while the host prepares the reply.
    window.setTimeout(reload, 400)
    try {
      const sent = await postBotTeamRequest({
        teamId: team.id,
        text,
        start: true,
        askProject: true,
        clientRequestId: replying.requestIdFor(text)
      })
      replying.settle(sent.replying?.botId ?? null)
      setNeedsOwner(
        sent.task === null && !sent.greeted && !sent.choice && !sent.answered && !sent.replying
      )
      setPending(
        sent.choice ? { choice: sent.choice, text, ...(sent.later ? { later: true } : {}) } : null
      )
      if (sent.startError) {
        toast.error(sent.startError)
      }
      if (sent.sentTo) {
        toast.success(
          translate('components.botTeams.sentToTeam', 'Sent to {{team}}', {
            team: sent.sentTo.teamName
          })
        )
      }
      reload()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      sending.current = false
      setTyping(null)
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

  // A send with the host shows who is typing; once it returns, the host's reply in flight does.
  const typingAuthor = typing === null ? replying.author : botTeamTypingAuthor(typing, team.bots)
  const statusOf = (task: BotTeamTask): BotTeamTaskStatus =>
    botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
  // Only a task nobody is working on can change hands.
  const reassignButton = (task: BotTeamTask): React.ReactNode =>
    IDLE_STATUSES.has(statusOf(task)) ? (
      <BotTeamReassignButton
        task={task}
        teams={[team, ...otherTeams]}
        disabled={offline}
        onDone={reload}
      />
    ) : null

  // A card sits right after the request that made it; the rest follow the conversation.
  const placement = useMemo(() => placeBotTeamRoomTasks(messages, tasks), [messages, tasks])
  const openTask = tasks.find((task) => task.id === openTaskId)
  const openAgent = botOf(openTask?.ownerBotId ?? null)?.agent
  if (openTask && openAgent) {
    return (
      <BotTeamTaskThread
        task={openTask}
        agent={openAgent}
        onBack={() => onOpenTask(null)}
        reassign={reassignButton(openTask)}
      />
    )
  }

  const taskCard = (task: BotTeamTask): React.JSX.Element => (
    <BotTeamTaskCard
      key={task.id}
      task={task}
      owner={botOf(task.ownerBotId)}
      status={statusOf(task)}
      projects={projects}
      offline={offline}
      reassign={reassignButton(task)}
      onMove={(next) => void moveTask(task.id, next)}
      onStart={() => void startTask(task.id)}
      onOpen={() => onOpenTask(task.id)}
    />
  )
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
                  {placement.cardsByMessageId.get(message.id)?.map(taskCard)}
                </div>
              )
            })}
            {placement.trailing.map(taskCard)}
            {tasks.map((task) => {
              const bot = botOf(task.ownerBotId)
              return bot && task.sessionId !== null && statusOf(task) === 'Waiting for you' ? (
                <BotTeamRoomQuestion key={task.id} task={task} bot={bot} />
              ) : null
            })}
            {typingAuthor ? <BotTeamTypingLine author={typingAuthor} bots={team.bots} /> : null}
            {pending ? (
              <BotTeamPendingChoice
                pending={pending}
                team={team}
                otherTeams={otherTeams}
                projects={projects}
                onAsked={(choice) =>
                  setPending((current) => (current ? { ...current, choice } : current))
                }
                onFiled={() => {
                  setPending(null)
                  reload()
                }}
                onCreateBot={() => onCreateBot?.()}
                onCreateTeam={() => onCreateTeam?.()}
              />
            ) : null}
            {needsOwner ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'components.botTeams.whoTakesIt',
                  'Who should take this? Mention a bot with @ and its name.'
                )}
              </p>
            ) : null}
          </div>
        </div>
        <BotTeamRoomComposer team={team} otherTeams={otherTeams} offline={offline} onSend={send} />
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
