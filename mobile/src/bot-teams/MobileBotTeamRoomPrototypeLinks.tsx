import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type {
  BotTeamMessage,
  BotTeamSentRequest,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { MobilePrototypeRequestLink } from '../prototypes/MobilePrototypeRequestLink'
import { useMobilePrototypeSetsOfSession } from '../prototypes/use-mobile-prototype-session-sets'
import type { RpcClient } from '../transport/rpc-client'
import {
  botTeamRoomPrototypeTasks,
  botTeamRoomTaskSessions,
  botTeamRoomTaskSets
} from '../../../src/shared/bot-team-room-prototype-tasks'

/** How the room opens a Prototypes set; null where Prototypes cannot open, so no link shows. */
export const BotTeamRoomPrototypeOpenContext = createContext<
  ((set: PrototypeListedSet) => void) | null
>(null)

type RoomContent = {
  messages: readonly BotTeamMessage[]
  tasks: readonly BotTeamTask[]
  sentRequests: readonly BotTeamSentRequest[]
}

/**
 * Renders, per message, the Prototypes sets of the tasks that message reports on: its own tasks and the
 * requests other teams took for it. `client` is null while the host is unreachable.
 */
export function useBotTeamRoomPrototypeLinks(
  client: RpcClient | null,
  room: RoomContent | null,
  teamId: string
): (messageId: string) => ReactNode {
  const open = useContext(BotTeamRoomPrototypeOpenContext)
  const { tasksByMessageId, roomSessions } = useMemo(() => {
    if (room === null) {
      return { tasksByMessageId: new Map<string, BotTeamTask[]>(), roomSessions: new Set<string>() }
    }
    const all = [...room.tasks, ...room.sentRequests.map((request) => request.task)]
    return {
      tasksByMessageId: botTeamRoomPrototypeTasks(room.messages, all, teamId),
      roomSessions: botTeamRoomTaskSessions(all)
    }
  }, [room, teamId])
  const refreshKey = room?.messages.length ?? 0
  return useCallback(
    (messageId: string) =>
      open === null
        ? null
        : tasksByMessageId
            .get(messageId)
            ?.map((task) => (
              <TaskPrototypeLinks
                key={task.id}
                client={client}
                sessionId={task.sessionId}
                roomSessions={roomSessions}
                refreshKey={refreshKey}
                onOpen={open}
              />
            )),
    [client, open, refreshKey, roomSessions, tasksByMessageId]
  )
}

function TaskPrototypeLinks({
  client,
  sessionId,
  roomSessions,
  refreshKey,
  onOpen
}: {
  client: RpcClient | null
  sessionId: string | null
  roomSessions: ReadonlySet<string>
  refreshKey: number
  onOpen: (set: PrototypeListedSet) => void
}) {
  // The room holds no delegation records, so children match by the origin their sets recorded.
  const sets = useMobilePrototypeSetsOfSession({
    client,
    scope: sessionId === null ? null : { sessionId },
    refreshKey
  })
  if (sessionId === null) {
    return null
  }
  return botTeamRoomTaskSets(sets, sessionId, roomSessions).map((set) => (
    <MobilePrototypeRequestLink key={set.requestId} set={set} onOpen={onOpen} />
  ))
}
