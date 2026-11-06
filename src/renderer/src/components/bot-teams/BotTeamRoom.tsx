import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useRightSidebarPageTarget } from '../../app-shell/right-sidebar-page-slot'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamRoom,
  postBotTeamRequest,
  setBotTeamTaskProject,
  startBotTeamTask
} from '@/runtime/runtime-bot-team-client'
import {
  botTeamTaskStatusIn,
  type BotTeamTaskStatus
} from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamProject,
  BotTeamSentRequest,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { BotTeamTypingLine } from './BotTeamTypingLine'
import { botTeamTypingAuthor } from '../../../../shared/bot-team-typing'
import { useBotTeamReplying } from './BotTeamRoomReplying'
import { BotTeamReassignButton } from './BotTeamReassignButton'
import { BotTeamPendingChoice, type BotTeamPendingChoiceRequest } from './BotTeamPendingChoice'
import { BotTeamRoomComposer, type BotTeamRoomReply } from './BotTeamRoomComposer'
import { BotTeamRoomPrototypeCard } from './BotTeamRoomPrototypeCard'
import { useBotTeamRoomPrototype } from './use-bot-team-room-prototype'
import type { BotTeamPrototypeChoice } from '../../../../shared/bot-team-prototype-choice'
import { useBotTeamRoomMentions } from './bot-team-mention-projects'
import { BotTeamSentTrackers } from './BotTeamRoomTracker'
import { BotTeamRoomMessage } from './BotTeamRoomMessage'
import { botTeamMessageRuns } from './bot-team-message-run'
import { useBotTeamRoomPrototypeLinks } from './BotTeamRoomPrototypeLinks'
import { useBotTeamRoomAttachments } from './bot-team-room-attach-state'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import { BotTeamTaskCard } from './BotTeamTaskCard'
import { BotTeamTaskThread } from './BotTeamTaskThread'
import { BotTeamRoomQuestion } from './BotTeamRoomQuestion'
import { BotTeamRoomSidePanel } from './BotTeamRoomSidePanel'
import { placeBotTeamRoomTasks } from '../../../../shared/bot-team-room-order'
import { NativeChatJumpToLatest } from '../native-chat/NativeChatJumpToLatest'
import { useBotTeamRoomScroll } from './use-bot-team-room-scroll'

const NO_PROJECT = 'none'
const NO_TEAMS: readonly BotTeam[] = []
const IDLE_STATUSES: ReadonlySet<BotTeamTaskStatus> = new Set(['Not started', 'Stopped', 'Stuck'])

const ROOM_CHECK_MS = 5_000

export function BotTeamRoom({
  team,
  openTaskId,
  onOpenTask,
  offline,
  header,
  otherTeams = NO_TEAMS,
  onCreateBot,
  onCreateTeam,
  onOpenFile,
  onOpenTeam
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
  /** Opens a file a message names in the team's Files view; without it the file chips stay plain. */
  onOpenFile?: (path: string) => void
  /** Opens another team's room, or one of its tasks; without it the tracker has no way in. */
  onOpenTeam?: (teamId: string, taskId: string | null) => void
}): React.JSX.Element {
  const [messages, setMessages] = useState<BotTeamMessage[]>([])
  const [tasks, setTasks] = useState<BotTeamTask[]>([])
  const [projects, setProjects] = useState<BotTeamProject[]>([])
  const [sent, setSent] = useState<BotTeamSentRequest[]>([])
  const [needsOwner, setNeedsOwner] = useState(false)
  const [pending, setPending] = useState<BotTeamPendingChoiceRequest | null>(null)
  // The text with the host, if any; the room shows who is typing until the reply comes back.
  const [typing, setTyping] = useState<string | null>(null)
  // A bot's Reply quotes its message above the composer; a new object per click asks again.
  const [replyTo, setReplyTo] = useState<BotTeamRoomReply | null>(null)
  const { mentionProjects, mentionIcons } = useBotTeamRoomMentions(team, otherTeams, projects)
  const replying = useBotTeamReplying(team.bots)
  const readReplying = replying.readRoom
  const sidePanel = useRightSidebarPageTarget()
  const statuses = useBotTeamSessionStatuses()
  const scroll = useBotTeamRoomScroll({
    teamId: team.id,
    hasContent: messages.length > 0 || tasks.length > 0
  })
  const botOf = (botId: string | null) => team.bots.find((bot) => bot.id === botId)
  const onAttachFiles = useBotTeamRoomAttachments({ teamId: team.id })

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
          setSent(room.sentRequests ?? [])
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

  const send = async (
    text: string,
    attachments: BotTeamRoomAttachment[] = [],
    prototypeChoice?: BotTeamPrototypeChoice,
    replyToMessageId?: string
  ): Promise<boolean> => {
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
        clientRequestId: replying.requestIdFor(text),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(prototypeChoice ? { prototypeChoice } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {})
      })
      replying.settle(sent.replying?.botId ?? null)
      setNeedsOwner(
        sent.task === null && !sent.greeted && !sent.choice && !sent.answered && !sent.replying
      )
      setPending(
        sent.choice
          ? {
              choice: sent.choice,
              text,
              ...(sent.later ? { later: true } : {}),
              ...(prototypeChoice ? { prototypeChoice } : {}),
              ...(attachments.length > 0 ? { attachments } : {})
            }
          : null
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

  const prototype = useBotTeamRoomPrototype({ bots: team.bots, post: send })

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
  const statusOf = (task: BotTeamTask): BotTeamTaskStatus => botTeamTaskStatusIn(task, statuses)
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
  const prototypeLinks = useBotTeamRoomPrototypeLinks(messages, tasks, sent, team.id)
  // A card, tracker or prototype row under a message ends its run, so the next message shows its author.
  const rowsBelow = (message: BotTeamMessage): boolean =>
    (placement.cardsByMessageId.get(message.id)?.length ?? 0) > 0 ||
    sent.some((request) => request.messageId === message.id) ||
    Boolean(prototypeLinks(message.id))
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

  // A tracker sits right after the message that asked another team; any without one follow the conversation.
  const trackers = (requests: BotTeamSentRequest[]): React.JSX.Element => (
    <BotTeamSentTrackers
      requests={requests}
      teams={otherTeams}
      statusOf={statusOf}
      offline={offline}
      onOpenTeam={onOpenTeam}
    />
  )
  const unplacedSent = sent.filter(
    (request) => !messages.some((message) => message.id === request.messageId)
  )

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
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scroll.attachScroll}
            onScroll={scroll.onScroll}
            className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto"
          >
            <div
              ref={scroll.attachContent}
              className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-6"
            >
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
              {placement.leading.map(taskCard)}
              {botTeamMessageRuns(messages, rowsBelow).map((run) => (
                <div key={run[0]?.id} className="flex flex-col gap-1.5">
                  {run.map((message, index) => (
                    <BotTeamRoomMessage
                      key={message.id}
                      message={message}
                      team={team}
                      otherTeams={otherTeams}
                      mentions={mentionIcons}
                      onOpenFile={onOpenFile}
                      onReply={(bot) =>
                        setReplyTo({
                          messageId: message.id,
                          botName: bot.name,
                          quote: message.text
                        })
                      }
                      continuesRun={index > 0}
                    >
                      {placement.cardsByMessageId.get(message.id)?.map(taskCard)}
                      {trackers(sent.filter((request) => request.messageId === message.id))}
                      {prototypeLinks(message.id)}
                    </BotTeamRoomMessage>
                  ))}
                </div>
              ))}
              {placement.trailing.map(taskCard)}
              {trackers(unplacedSent)}
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
          <NativeChatJumpToLatest visible={scroll.showJump} onJump={scroll.jumpToEnd} />
        </div>
        <BotTeamRoomPrototypeCard prototype={prototype} />
        <BotTeamRoomComposer
          team={team}
          otherTeams={otherTeams}
          projects={mentionProjects}
          offline={offline}
          onSend={prototype.send}
          onAttachFiles={onAttachFiles}
          replyTo={replyTo}
        />
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
