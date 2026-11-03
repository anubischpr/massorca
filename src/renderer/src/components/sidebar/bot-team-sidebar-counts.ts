import { create } from 'zustand'
import { currentBotTeamHost } from '@/runtime/bot-team-host'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'

/** A team's room as the Bot teams sidebar counts it, from the host's last answer. */
export type BotTeamRoomCounts = {
  tasks: BotTeamTask[]
  projects: BotTeamProject[]
  /** Tasks other teams filed in this team's projects. */
  projectTasks: BotTeamTask[]
  /** False on a host from before shared projects, which sends no linked teams. */
  sharedProjects: boolean
}

/** Every team's last answer, keyed by `botTeamRoomCountsKey`: a switch back shows it at once. */
export const useBotTeamRoomCountsStore = create<{ answers: Record<string, BotTeamRoomCounts> }>(
  () => ({ answers: {} })
)

// A host that never answers must not hold a team's counts: its request is given up after this.
const ANSWER_DEADLINE_MS = 15_000

// At most one request per team runs; a fresh call queues one more behind it.
const flights = new Map<string, Promise<void>>()
const queued = new Map<string, Promise<void>>()
// A reset bumps this, so a request sent before it can neither answer nor queue anything.
let epoch = 0

/** Host and team together, so another host's counts never show for this one. */
export function botTeamRoomCountsKey(host: string, teamId: string): string {
  return JSON.stringify([host, teamId])
}

function countsOf(room: Awaited<ReturnType<typeof listBotTeamRoom>>): BotTeamRoomCounts {
  const projects = room.projects ?? []
  return {
    tasks: room.tasks,
    projects,
    projectTasks: room.projectTasks ?? [],
    sharedProjects: projects.every((project) => project.linkedTeamIds !== undefined)
  }
}

function send(key: string, teamId: string): Promise<void> {
  const sentIn = epoch
  const request = new Promise<void>((resolve, reject) => {
    let open = true
    let deadline: ReturnType<typeof setTimeout> | undefined
    // The first of answer, error or deadline wins; a late answer after the deadline is dropped.
    const close = (action: () => void): void => {
      if (open && sentIn === epoch) {
        open = false
        clearTimeout(deadline)
        action()
      }
    }
    deadline = setTimeout(() => close(() => resolve()), ANSWER_DEADLINE_MS)
    listBotTeamRoom(teamId, { includeArchived: true }).then(
      (room) =>
        close(() => {
          const counts = countsOf(room)
          useBotTeamRoomCountsStore.setState((state) => ({
            answers: { ...state.answers, [key]: counts }
          }))
          resolve()
        }),
      (error: unknown) => close(() => reject(error))
    )
  })
  flights.set(key, request)
  const forget = (): void => {
    if (flights.get(key) === request) {
      flights.delete(key)
    }
  }
  void request.then(forget, forget)
  return request
}

/**
 * Lists a team's room on the current host. A call joins the request in flight; a `fresh` call
 * instead queues one that starts after it, so its answer is never older than the call.
 */
export function loadBotTeamRoomCounts(
  teamId: string,
  options: { fresh?: boolean } = {}
): Promise<void> {
  const key = botTeamRoomCountsKey(currentBotTeamHost(), teamId)
  const next = queued.get(key)
  if (next) {
    return next
  }
  const flight = flights.get(key)
  if (!flight) {
    return send(key, teamId)
  }
  if (!options.fresh) {
    return flight
  }
  const after = flight.then(
    () => send(key, teamId),
    () => send(key, teamId)
  )
  queued.set(key, after)
  const unqueue = (): void => {
    if (queued.get(key) === after) {
      queued.delete(key)
    }
  }
  void after.then(unqueue, unqueue)
  return after
}

/** Forgets every answer and request; for tests only. */
export function resetBotTeamRoomCountsForTests(): void {
  epoch += 1
  flights.clear()
  queued.clear()
  useBotTeamRoomCountsStore.setState({ answers: {} })
}
