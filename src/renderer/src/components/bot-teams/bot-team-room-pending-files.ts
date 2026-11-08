import { useCallback, useState } from 'react'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'

// Why: the composer unmounts when the person opens another section; the files it held wait here.
const pendingByTeam = new Map<string, BotTeamRoomAttachment[]>()

type PendingUpdate =
  | BotTeamRoomAttachment[]
  | ((current: BotTeamRoomAttachment[]) => BotTeamRoomAttachment[])

/** A room's attached, unsent files: kept per team for this run, so leaving the room keeps them. */
export function useBotTeamRoomPendingFiles(
  teamId: string
): [BotTeamRoomAttachment[], (update: PendingUpdate) => void] {
  const [pending, setPendingState] = useState<BotTeamRoomAttachment[]>(
    () => pendingByTeam.get(teamId) ?? []
  )
  const setPending = useCallback(
    (update: PendingUpdate): void => {
      // Why the map, not the updater's state: it already holds every earlier call's result.
      const current = pendingByTeam.get(teamId) ?? []
      const next = typeof update === 'function' ? update(current) : update
      if (next.length === 0) {
        pendingByTeam.delete(teamId)
      } else {
        pendingByTeam.set(teamId, next)
      }
      setPendingState(next)
    },
    [teamId]
  )
  return [pending, setPending]
}

export function clearBotTeamRoomPendingFilesForTests(): void {
  pendingByTeam.clear()
}
