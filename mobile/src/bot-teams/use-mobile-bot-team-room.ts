import { useCallback, useEffect, useRef, useState } from 'react'
import { BOT_TEAM_REPLYING_POLL_MS } from '../../../src/shared/bot-team-typing'
import type { RpcClient } from '../transport/rpc-client'
import { listMobileBotTeamRoom, type MobileBotTeamRoomData } from './mobile-bot-team-room-rpc'

const ROOM_CHECK_MS = 5_000

/** A team's room as the host last answered it, re-read on an interval while the host is reachable. */
export function useMobileBotTeamRoom(client: RpcClient, teamId: string, offline: boolean) {
  const [room, setRoom] = useState<MobileBotTeamRoomData | null>(null)
  const latestRead = useRef(0)
  const reload = useCallback(async () => {
    const read = ++latestRead.current
    const next = await listMobileBotTeamRoom(client, teamId, { withLinkedProjects: true })
    // An older answer must not undo a newer one.
    if (next && read === latestRead.current) {
      setRoom(next)
    }
  }, [client, teamId])

  // A reply the host is still writing is read faster, so its line shows up when it lands.
  const replyInFlight = (room?.replying.length ?? 0) > 0
  useEffect(() => {
    if (offline) {
      return
    }
    void reload()
    // Bots post and add tasks on their own; the host has no push for the room.
    const timer = setInterval(
      () => void reload(),
      replyInFlight ? BOT_TEAM_REPLYING_POLL_MS : ROOM_CHECK_MS
    )
    return () => clearInterval(timer)
  }, [reload, offline, replyInFlight])

  return { room, reload }
}
