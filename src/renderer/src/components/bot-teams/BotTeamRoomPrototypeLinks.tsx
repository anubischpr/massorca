import { useCallback, useMemo, type ReactNode } from 'react'
import {
  botTeamRoomPrototypeTasks,
  botTeamRoomTaskSessions,
  botTeamRoomTaskSets,
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
  const { tasksByMessageId, roomSessions } = useMemo(() => {
    const all = [...tasks, ...sent.map((request) => request.task)]
    return {
      tasksByMessageId: botTeamRoomPrototypeTasks(messages, all, teamId),
      roomSessions: botTeamRoomTaskSessions(all)
    }
  }, [messages, tasks, sent, teamId])
  return useCallback(
    (messageId: string) =>
      tasksByMessageId
        .get(messageId)
        ?.map((task) => (
          <TaskPrototypeLinks
            key={task.id}
            sessionId={task.sessionId}
            roomSessions={roomSessions}
          />
        )),
    [tasksByMessageId, roomSessions]
  )
}

function TaskPrototypeLinks({
  sessionId,
  roomSessions
}: {
  sessionId: string | null
  roomSessions: ReadonlySet<string>
}): ReactNode {
  // The room holds no delegation records, so children match by the origin their sets recorded.
  const sets = usePrototypeSetsOfSession(sessionId === null ? null : { sessionId })
  if (sessionId === null) {
    return null
  }
  return botTeamRoomTaskSets(sets, sessionId, roomSessions).map((set) => (
    <PrototypeSetLinkCard key={set.requestId} set={set} />
  ))
}
