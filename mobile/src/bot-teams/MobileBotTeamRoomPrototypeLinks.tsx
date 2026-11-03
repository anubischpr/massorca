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
import { botTeamRoomPrototypeTasks } from './mobile-bot-team-room-prototype-tasks'

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
  const tasksByMessageId = useMemo(
    () =>
      room === null
        ? new Map<string, BotTeamTask[]>()
        : botTeamRoomPrototypeTasks(
            room.messages,
            [...room.tasks, ...room.sentRequests.map((request) => request.task)],
            teamId
          ),
    [room, teamId]
  )
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
                refreshKey={refreshKey}
                onOpen={open}
              />
            )),
    [client, open, refreshKey, tasksByMessageId]
  )
}

function TaskPrototypeLinks({
  client,
  sessionId,
  refreshKey,
  onOpen
}: {
  client: RpcClient | null
  sessionId: string | null
  refreshKey: number
  onOpen: (set: PrototypeListedSet) => void
}) {
  // The room holds no delegation records, so children match by the origin their sets recorded.
  const sets = useMobilePrototypeSetsOfSession({
    client,
    scope: sessionId === null ? null : { sessionId },
    refreshKey
  })
  return sets.map((set) => (
    <MobilePrototypeRequestLink key={set.requestId} set={set} onOpen={onOpen} />
  ))
}
