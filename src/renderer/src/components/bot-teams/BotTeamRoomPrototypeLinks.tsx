import { useCallback, useMemo, type ReactNode } from 'react'
import {
  botTeamRoomPrototypeTasks,
  type BotTeamRoomReportMessage,
  type BotTeamRoomReportTask
} from '../../../../shared/bot-team-room-prototype-tasks'
import { PrototypeSetLinkCard } from '../native-chat/NativeChatPrototypeLinkCard'
import { usePrototypeSetsOfSession } from '../prototypes/use-prototype-set-for-request'

/**
 * Renders, per message, the Prototypes sets of the tasks that message reports on: its own tasks and the
 * requests other teams took for it. The phone room places them by the same rule.
 */
export function useBotTeamRoomPrototypeLinks(
  messages: readonly BotTeamRoomReportMessage[],
  tasks: readonly BotTeamRoomReportTask[],
  sent: readonly { task: BotTeamRoomReportTask }[],
  teamId: string
): (messageId: string) => ReactNode {
  const tasksByMessageId = useMemo(
    () =>
      botTeamRoomPrototypeTasks(
        messages,
        [...tasks, ...sent.map((request) => request.task)],
        teamId
      ),
    [messages, tasks, sent, teamId]
  )
  return useCallback(
    (messageId: string) =>
      tasksByMessageId
        .get(messageId)
        ?.map((task) => <TaskPrototypeLinks key={task.id} sessionId={task.sessionId} />),
    [tasksByMessageId]
  )
}

function TaskPrototypeLinks({ sessionId }: { sessionId: string | null }): ReactNode {
  // The room holds no delegation records, so children match by the origin their sets recorded.
  const sets = usePrototypeSetsOfSession(sessionId === null ? null : { sessionId })
  return sets.map((set) => <PrototypeSetLinkCard key={set.requestId} set={set} />)
}
