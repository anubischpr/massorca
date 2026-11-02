import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamTaskSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  title: z.string(),
  prompt: z.string(),
  ownerBotId: z.string(),
  /** Null until the task starts: it waits in Todo with no agent working on it. */
  sessionId: z.string().nullable(),
  // The default reads a host from before projects existed.
  projectId: z.string().nullable().default(null),
  // The host's time the task was made; a host from before it sends none.
  createdAt: z.number().nullable().optional()
})

/** Where a project's code comes from: a repository that exists, or a new folder set up with git. */
export const BotTeamCodeSourceSchema = z.enum(['repo', 'folder'])

/** What a project's bots read before they start: the Brief on the design. */
export const BotTeamBriefSchema = z.object({
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  decisions: z.array(z.string())
})

const EMPTY_BRIEF = { requirements: [], constraints: [], decisions: [] }

/** A workspace on the team's host that a project's tasks run in, named by its workspace key. */
export const BotTeamProjectWorkspaceSchema = z.object({
  key: z.string(),
  name: z.string()
})

/** A git worktree or a folder workspace on the team's host that a project can link to. */
export const BotTeamLinkableWorkspaceSchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(['git', 'folder'])
})

export const BotTeamProjectSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  goal: z.string(),
  // Null: not connected to code. The default reads a host from before code sources existed.
  codeSource: BotTeamCodeSourceSchema.nullable().default(null),
  // The defaults read a host from before briefs existed.
  brief: BotTeamBriefSchema.default(EMPTY_BRIEF),
  briefUpdatedAt: z.number().nullable().default(null),
  // Optional: a host from before Workspaces projects omits it. Null: tasks run in the team's folder.
  workspace: BotTeamProjectWorkspaceSchema.nullable().optional()
})

export const BotTeamProjectCreate = z.object({
  teamId: requiredString('Missing team id'),
  name: requiredString('Missing project name'),
  goal: z.string().trim().default(''),
  codeSource: BotTeamCodeSourceSchema.nullable().default(null)
})

export const BotTeamProjectSetCodeSource = z.object({
  projectId: requiredString('Missing project id'),
  codeSource: BotTeamCodeSourceSchema
})

export const BotTeamProjectSetBrief = z.object({
  projectId: requiredString('Missing project id'),
  goal: z.string().trim(),
  brief: BotTeamBriefSchema
})

/** Null unlinks the project, so its tasks go back to the team's folder. */
export const BotTeamProjectSetWorkspace = z.object({
  projectId: requiredString('Missing project id'),
  workspaceKey: z.string().min(1).nullable()
})

export const BotTeamTaskSetProject = z.object({
  taskId: requiredString('Missing task id'),
  projectId: z.string().min(1).nullable()
})

export const BotTeamMessageSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  /** Null when the person wrote it. */
  authorBotId: z.string().nullable(),
  text: z.string(),
  /** The host's time the message was written; a host from before it sends none. */
  createdAt: z.number().nullable().optional()
})

export const BotTeamTaskCreate = z.object({
  teamId: requiredString('Missing team id'),
  title: requiredString('Missing task title'),
  prompt: z.string().trim().default(''),
  ownerBotId: requiredString('Missing bot id')
})

export const BotTeamMessagePost = z.object({
  teamId: requiredString('Missing team id'),
  text: requiredString('Missing message text'),
  /** False saves the task to Todo without starting a bot. */
  start: z.boolean().default(true),
  /** Only a client that can show the project question sends true; an older one never gets the question. */
  askProject: z.boolean().optional()
})

/** Files a request the room could not place by itself: to a bot, and to a team when `toTeamId` is set. */
export const BotTeamRequestAssign = z.object({
  teamId: requiredString('Missing team id'),
  text: requiredString('Missing request text'),
  /** Absent: the least busy bot of the receiving team takes it. */
  botId: z.string().min(1).optional(),
  toTeamId: z.string().min(1).optional(),
  start: z.boolean().default(true),
  /** The answer to the project question: a project of the team, or null for none. Absent until asked. */
  projectId: z.string().min(1).nullable().optional(),
  /** The other bots a composite task has parts for, as the question carried them. */
  alsoNeeds: z.array(z.string().min(1)).optional(),
  later: z.boolean().optional(),
  askProject: z.boolean().optional()
})

/** Gives an idle task to a bot of any team; its team follows the bot. Nothing starts: Start does that. */
export const BotTeamTaskReassign = z.object({
  taskId: requiredString('Missing task id'),
  botId: requiredString('Missing bot id')
})

export const BotTeamRoomSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamTaskStart = z.object({
  taskId: requiredString('Missing task id')
})

export type BotTeamTask = z.output<typeof BotTeamTaskSchema>
export type BotTeamBrief = z.output<typeof BotTeamBriefSchema>
export type BotTeamCodeSource = z.output<typeof BotTeamCodeSourceSchema>
export type BotTeamProjectWorkspace = z.output<typeof BotTeamProjectWorkspaceSchema>
export type BotTeamLinkableWorkspace = z.output<typeof BotTeamLinkableWorkspaceSchema>
export type BotTeamProject = z.output<typeof BotTeamProjectSchema>
export type BotTeamProjectInput = z.output<typeof BotTeamProjectCreate>
export type BotTeamMessage = z.output<typeof BotTeamMessageSchema>
export type BotTeamTaskInput = z.output<typeof BotTeamTaskCreate>
export type BotTeamMessageInput = {
  teamId: string
  text: string
  authorBotId: string | null
}
