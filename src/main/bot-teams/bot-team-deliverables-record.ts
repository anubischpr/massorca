import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { getAppEnvironment } from '../../shared/app-environment'
import { isBotTeamFileVisible } from '../../shared/rpc-contract/bot-team-files-visibility'
import { listBotTeamDeliverables } from './bot-team-deliverables'
import { readWorktreeChanges, type WorktreeLocation } from './bot-team-worktree-deliverables'

const MAX_RECORDS_PER_TEAM = 200
const MAX_PROJECT_FILES = 500
const MAX_RECORDS_LISTED = 50
const TEAM_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/** Where a finished task of a project ran, kept so the team's Files can list what it changed there. */
export type TaskDeliverableRecord = {
  taskId: string
  teamId: string
  projectId: string
  /** The workspace the task ran in, as the host names it: its id opens the files in place. */
  workspaceId: string
  /** That workspace's folder on this host. */
  folder: string
  /** `worktree`: a linked git worktree, listed by what it changed; `folder`: a folder project, listed by time. */
  kind: 'worktree' | 'folder'
  /** When the task began, for a folder project's files written since then. */
  since: number
  recordedAt: number
  /** Files the finished task wrote or named, listed even when git ignores them or they are old. */
  files?: string[]
}

const RecordSchema = z.object({
  taskId: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  folder: z.string(),
  kind: z.enum(['worktree', 'folder']),
  since: z.number(),
  recordedAt: z.number(),
  files: z.array(z.string()).optional()
})

const StoreSchema = z.object({ records: z.array(RecordSchema) })

/** A linked project's files a team's finished tasks touched, grouped by project. */
export type ProjectDeliverableFiles = {
  projects: {
    projectId: string
    name: string
    files: { workspaceId: string; relativePath: string }[]
  }[]
  truncated: boolean
}

/** Next to the app's data, never in a team's folder: the team's versions are kept the same way. */
export function botTeamDeliverableStoreDir(): string {
  return path.join(getAppEnvironment().getPath('userData'), 'bot-team-deliverables')
}

function recordsFile(storeDir: string, teamId: string): string {
  if (!TEAM_ID_PATTERN.test(teamId)) {
    throw new Error(`Team id ${teamId} cannot name a file.`)
  }
  return path.join(storeDir, `${teamId}.json`)
}

/** A team's records, oldest first; an unreadable or absent file holds none. */
export function readTeamDeliverableRecords(
  storeDir: string,
  teamId: string
): TaskDeliverableRecord[] {
  const file = recordsFile(storeDir, teamId)
  try {
    const parsed = StoreSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data.records : []
  } catch {
    return []
  }
}

/** Keeps a finished task's record once; the newest records of a team are kept, up to a bound. */
export function recordTaskDeliverables(storeDir: string, record: TaskDeliverableRecord): void {
  const kept = readTeamDeliverableRecords(storeDir, record.teamId).filter(
    (entry) => entry.taskId !== record.taskId
  )
  const records = [...kept, record]
    .sort((left, right) => left.recordedAt - right.recordedAt)
    .slice(-MAX_RECORDS_PER_TEAM)
  mkdirSync(storeDir, { recursive: true })
  const file = recordsFile(storeDir, record.teamId)
  // Why a temporary file: a reader never sees a half-written record file.
  const temporary = `${file}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify({ records }, null, 2))
  renameSync(temporary, file)
}

/** Adds files to a task's record, once each; a task with no record has nothing to list them under. */
export function addTaskDeliverableFiles(
  storeDir: string,
  teamId: string,
  taskId: string,
  relativePaths: readonly string[]
): void {
  const existing = readTeamDeliverableRecords(storeDir, teamId).find(
    (entry) => entry.taskId === taskId
  )
  if (!existing || relativePaths.length === 0) {
    return
  }
  const files = [...new Set([...(existing.files ?? []), ...relativePaths])].slice(
    -MAX_PROJECT_FILES
  )
  recordTaskDeliverables(storeDir, { ...existing, files })
}

function isLinkedWorktree(folder: string): boolean {
  try {
    return lstatSync(path.join(folder, '.git')).isFile()
  } catch {
    return false
  }
}

/**
 * Records where a finished task of a project ran, when it ran in a folder this host can read.
 * Null for a task with no project, or one that ran somewhere this host cannot list.
 */
export function recordFinishedTaskDeliverables(args: {
  storeDir: string
  taskId: string
  teamId: string
  projectId: string | null
  workspaceId: string | null
  location: WorktreeLocation | null
  since: number
  now: number
}): TaskDeliverableRecord | null {
  if (args.projectId === null || args.workspaceId === null || args.location?.local !== true) {
    return null
  }
  const earlier = readTeamDeliverableRecords(args.storeDir, args.teamId).find(
    (entry) => entry.taskId === args.taskId
  )
  const record: TaskDeliverableRecord = {
    ...(earlier?.files ? { files: earlier.files } : {}),
    taskId: args.taskId,
    teamId: args.teamId,
    projectId: args.projectId,
    workspaceId: args.workspaceId,
    folder: args.location.path,
    kind: isLinkedWorktree(args.location.path) ? 'worktree' : 'folder',
    since: args.since,
    recordedAt: args.now
  }
  recordTaskDeliverables(args.storeDir, record)
  return record
}

/** The files a record's workspace holds now: what a worktree changed, or a folder's files since the task began. */
async function listRecordDeliverables(record: TaskDeliverableRecord): Promise<string[]> {
  const registered = (record.files ?? []).filter((file) =>
    existsSync(path.join(record.folder, file))
  )
  if (record.kind === 'folder') {
    // Why: the folder listing uses the host's separators; Files names every file with '/'.
    const listed = listBotTeamDeliverables(record.folder, record.since).map((file) =>
      file.split(path.sep).join('/')
    )
    return [...new Set([...listed, ...registered])]
  }
  return [...new Set([...((await readWorktreeChanges(record.folder))?.files ?? []), ...registered])]
}

/**
 * The files of each live project a team's finished tasks touched, newest task first. Each file opens
 * where it is: nothing is copied. Dot folders and tool folders are left out.
 */
export async function listTeamProjectDeliverables(args: {
  storeDir: string
  teamId: string
  projects: readonly { projectId: string; name: string }[]
  /** Replaces the default listing of a record's workspace; tests use it. */
  listRecord?: (record: TaskDeliverableRecord) => Promise<string[]>
}): Promise<ProjectDeliverableFiles> {
  const names = new Map(args.projects.map((project) => [project.projectId, project.name]))
  const list = args.listRecord ?? listRecordDeliverables
  const sections = new Map<string, { workspaceId: string; relativePath: string }[]>()
  let total = 0
  let truncated = false
  // Why a cap: each listed record may run git in its worktree, and the list refreshes while Files is open.
  const newestFirst = readTeamDeliverableRecords(args.storeDir, args.teamId)
    .toReversed()
    .slice(0, MAX_RECORDS_LISTED)
  for (const record of newestFirst) {
    if (!names.has(record.projectId) || truncated) {
      continue
    }
    for (const relativePath of await list(record)) {
      if (!isBotTeamFileVisible(relativePath)) {
        continue
      }
      const files = sections.get(record.projectId) ?? []
      const seen = files.some(
        (file) => file.workspaceId === record.workspaceId && file.relativePath === relativePath
      )
      if (seen) {
        continue
      }
      if (total >= MAX_PROJECT_FILES) {
        truncated = true
        break
      }
      files.push({ workspaceId: record.workspaceId, relativePath })
      sections.set(record.projectId, files)
      total += 1
    }
  }
  return {
    projects: [...sections.entries()].map(([projectId, files]) => ({
      projectId,
      name: names.get(projectId) ?? projectId,
      files
    })),
    truncated
  }
}
