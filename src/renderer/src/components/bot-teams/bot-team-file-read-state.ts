import { create } from 'zustand'

const STORAGE_KEY = 'orca.botTeams.seenFiles'
const MAX_SEEN_PER_TEAM = 2000

/** The paths each team's Files the person has seen, keyed by team id. */
type SeenFiles = Readonly<Record<string, readonly string[]>>

type SeenFilesState = {
  seen: SeenFiles
  /** A team listed for the first time: what is there now counts as seen, so only later files are new. */
  seedTeam: (teamId: string, paths: readonly string[]) => void
  markSeen: (teamId: string, path: string) => void
}

function isSeenFiles(value: unknown): value is Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(
    (entry: unknown) =>
      Array.isArray(entry) && entry.every((item: unknown) => typeof item === 'string')
  )
}

function readStored(): SeenFiles {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return isSeenFiles(parsed) ? parsed : {}
  } catch {
    // Storage blocked or corrupt: the read state then lasts for this session only.
    return {}
  }
}

function writeStored(seen: SeenFiles): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
  } catch {
    // Storage full or blocked: the read state still holds for this session.
  }
}

export const useBotTeamSeenFilesStore = create<SeenFilesState>((set, get) => {
  const save = (teamId: string, paths: readonly string[]): void => {
    const seen = { ...get().seen, [teamId]: paths.slice(-MAX_SEEN_PER_TEAM) }
    set({ seen })
    writeStored(seen)
  }
  return {
    seen: readStored(),
    seedTeam: (teamId, paths) => {
      if (get().seen[teamId] === undefined) {
        save(teamId, paths)
      }
    },
    markSeen: (teamId, path) => {
      const current = get().seen[teamId] ?? []
      if (!current.includes(path)) {
        save(teamId, [...current, path])
      }
    }
  }
})

/** The listed files not seen yet; none while the team has no record, which `seedTeam` gives it first. */
export function unseenBotTeamFiles(
  listed: readonly string[],
  seen: readonly string[] | undefined
): string[] {
  if (seen === undefined) {
    return []
  }
  const known = new Set(seen)
  return listed.filter((path) => !known.has(path))
}
