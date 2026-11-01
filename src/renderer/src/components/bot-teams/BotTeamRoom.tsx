import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUp, ChevronLeft, Play } from 'lucide-react'
import { toast } from 'sonner'
import StatusIndicator, { type Status } from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import NativeChatView from '@/components/native-chat/NativeChatView'
import { botTeamHostTarget, useBotTeamHost } from '@/runtime/bot-team-host'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamRoom,
  postBotTeamRequest,
  startBotTeamTask
} from '@/runtime/runtime-bot-team-client'
import { botTeamTaskStatus, type BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { BotAgentIcon } from './BotAgentIcon'

type SideFilter = 'Active' | 'Stopped' | 'Done'

const SIDE_FILTER_TEST: Record<SideFilter, (status: BotTeamTaskStatus) => boolean> = {
  Active: (status) => status !== 'Done' && status !== 'Stopped',
  Stopped: (status) => status === 'Stopped',
  Done: (status) => status === 'Done'
}

function statusGlyph(status: BotTeamTaskStatus): Status {
  if (status === 'Working') {
    return 'working'
  }
  return status === 'Waiting for you' ? 'permission' : 'inactive'
}

function statusLabel(status: BotTeamTaskStatus): string {
  switch (status) {
    case 'Not started':
      return translate('components.botTeams.notStarted', 'Not started')
    case 'Working':
      return translate('components.botTeams.working', 'Working')
    case 'Waiting for you':
      return translate('components.botTeams.waitingForYou', 'Waiting for you')
    case 'Stopped':
      return translate('components.botTeams.stopped', 'Stopped')
    case 'Stuck':
      return translate('components.botTeams.stuck', 'Stuck')
    case 'Done':
      return translate('components.botTeams.done', 'Done')
  }
}

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
  const [text, setText] = useState('')
  const [needsLead, setNeedsLead] = useState(false)
  const [sideFilter, setSideFilter] = useState<SideFilter>('Active')
  const statuses = useBotTeamSessionStatuses()
  const botOf = (botId: string | null) => team.bots.find((bot) => bot.id === botId)

  const reload = useCallback(() => {
    void listBotTeamRoom(team.id).then(
      (room) => {
        setMessages(room.messages)
        setTasks(room.tasks)
      },
      (error: unknown) => toast.error(String(error))
    )
  }, [team.id])

  useEffect(reload, [reload])
  // Catches up on what happened while the host was out of reach.
  useEffect(() => {
    if (!offline) {
      reload()
    }
  }, [offline, reload])

  const send = async (start: boolean): Promise<void> => {
    try {
      const sent = await postBotTeamRequest({ teamId: team.id, text: text.trim(), start })
      setText('')
      setNeedsLead(sent.task === null)
      if (sent.startError) {
        toast.error(sent.startError)
      }
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
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

  const openTask = tasks.find((task) => task.id === openTaskId)
  const openAgent = botOf(openTask?.ownerBotId ?? null)?.agent
  if (openTask && openAgent) {
    return <BotTeamTaskThread task={openTask} agent={openAgent} onBack={() => onOpenTask(null)} />
  }

  const empty = offline || text.trim() === ''
  const statusOf = (task: BotTeamTask): BotTeamTaskStatus =>
    botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
  const sideTasks = tasks.filter((task) => SIDE_FILTER_TEST[sideFilter](statusOf(task)))
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
          <StatusIndicator status={statusGlyph(statusOf(task))} showTooltip={false} />
          {statusLabel(
            botTeamTaskStatus(
              task.sessionId,
              task.sessionId === null ? undefined : statuses.get(task.sessionId)
            )
          )}
          {offline && task.sessionId !== null
            ? translate('components.botTeams.cannotConfirm', ', can’t confirm now')
            : ''}
        </span>
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
              return (
                <div key={message.id} className="flex flex-col gap-3">
                  {author ? (
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <BotAgentIcon agent={author.agent} size={16} />
                      {author.name}
                    </div>
                  ) : null}
                  <div
                    className={
                      author
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
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="mx-auto flex max-w-[736px] items-end gap-2 rounded-xl border border-input p-1.5">
            <Textarea
              className="min-h-12 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              aria-label={translate('components.botTeams.messageTeam', 'Message the team')}
              placeholder={
                offline
                  ? translate(
                      'components.botTeams.writeWhenBack',
                      'You can write again when this host is back'
                    )
                  : translate(
                      'components.botTeams.messageTeamHint',
                      'Message the team, or type @ to ask one bot'
                    )
              }
              disabled={offline}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button
              size="icon"
              className="rounded-full"
              aria-label={translate('components.botTeams.send', 'Send')}
              disabled={empty}
              onClick={() => void send(true)}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <aside className="scrollbar-sleek flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
        <h2 className="px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('components.botTeams.tasks', 'Tasks')}
        </h2>
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {(['Active', 'Stopped', 'Done'] as const).map((filter) => (
            <Button
              key={filter}
              variant={filter === sideFilter ? 'secondary' : 'outline'}
              size="xs"
              className="rounded-full"
              onClick={() => setSideFilter(filter)}
            >
              {filter} {tasks.filter((task) => SIDE_FILTER_TEST[filter](statusOf(task))).length}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {sideTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              disabled={offline || task.sessionId === null}
              onClick={() => onOpenTask(task.id)}
              className="flex w-full gap-2.5 rounded-lg p-2 text-left hover:bg-sidebar-accent"
            >
              <span className="mt-0.5 shrink-0">
                <BotAgentIcon agent={botOf(task.ownerBotId)?.agent} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{task.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <StatusIndicator status={statusGlyph(statusOf(task))} showTooltip={false} />
                  {statusLabel(statusOf(task))}
                </span>
              </span>
            </button>
          ))}
          {sideTasks.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {`No ${sideFilter.toLowerCase()} tasks`}
            </p>
          ) : null}
        </div>
        <h2 className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('components.botTeams.bots', 'Bots')}
        </h2>
        <div className="flex flex-col gap-0.5 px-2 pb-3">
          {team.bots.map((bot) => {
            const own = tasks.find(
              (task) => task.ownerBotId === bot.id && statusOf(task) !== 'Done'
            )
            return (
              <div key={bot.id} className="flex gap-2.5 rounded-lg p-2">
                <span className="mt-0.5 shrink-0">
                  <BotAgentIcon agent={bot.agent} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{bot.name}</span>
                  <span className="block text-xs text-muted-foreground">{bot.job}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {own
                      ? translate('components.botTeams.ownsTask', 'Owns {{title}}', {
                          title: own.title
                        })
                      : translate('components.botTeams.notInTask', 'Not in a task')}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
