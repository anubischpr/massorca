import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon } from '@/lib/agent-catalog'
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
  offline
}: {
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
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {messages.map((message) => {
          const author = botOf(message.authorBotId)
          return (
            <div key={message.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                {author?.name ?? translate('components.botTeams.you', 'You')}
              </div>
              {message.text}
            </div>
          )
        })}
        {needsLead ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.whoTakesIt',
              'Who should take this? Mention a bot with @ and its name.'
            )}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label={translate('components.botTeams.messageTeam', 'Message the team')}
          placeholder={translate('components.botTeams.messageTeam', 'Message the team')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={empty} onClick={() => void send(false)}>
            {translate('components.botTeams.saveToTodo', 'Save to Todo')}
          </Button>
          <Button size="sm" disabled={empty} onClick={() => void send(true)}>
            {translate('components.botTeams.send', 'Send')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{translate('components.botTeams.tasks', 'Tasks')}</h2>
        {tasks.map((task) => {
          const owner = botOf(task.ownerBotId)
          return (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <AgentIcon agent={owner?.agent} size={20} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{task.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {owner?.name}
                  {' · '}
                  {statusLabel(
                    botTeamTaskStatus(
                      task.sessionId,
                      task.sessionId === null ? undefined : statuses.get(task.sessionId)
                    )
                  )}
                  {offline && task.sessionId !== null
                    ? translate('components.botTeams.cannotConfirm', ', can’t confirm now')
                    : ''}
                </div>
              </div>
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
        })}
      </div>
    </div>
  )
}
