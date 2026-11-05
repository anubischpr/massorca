import { z } from 'zod'
import { requiredString, requiredStringAllowingEmpty } from './rpc-param-primitives'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  BotTeamRoomAttachmentSchema,
  type BotTeamRoomAttachment
} from '../bot-team-room-attachments'
import { BOT_TEAM_TASK_LAST_STATUSES } from '../bot-team-task-status'

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
  createdAt: z.number().nullable().optional(),
  // The terminal status the host kept for its session; null while the session works or has none yet.
  lastStatus: z.enum(BOT_TEAM_TASK_LAST_STATUSES).nullable().optional(),
  // A routine run started it, so the room shows it at the time it ran; SQLite reads back 0 or 1.
  fromRoutine: z.coerce.boolean().optional(),
  // The bot ended its turn on a question the room carries; set only while the person owes an answer.
  // A separate field, not a new `lastStatus` value: a client from before it rejects an unknown one.
  awaitingPerson: z.boolean().optional()
})

/** Where a project's code comes from: a repository that exists, or a new folder set up with git. */
export const BotTeamCodeSourceSchema = z.enum(['repo', 'folder'])

/** What a project's bots read before they start: the Brief on the design. */
export const BotTeamBriefSchema = z.object({
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  decisions: z.array(z.string()),
  // Optional: the Brief as Markdown. A host from before it omits it; bots then read the lists.
  markdown: z.string().optional()
})

const EMPTY_BRIEF = { requirements: [], constraints: [], decisions: [] }

/** A workspace on the team's host that a project's tasks run in, named by its workspace key. */
export const BotTeamProjectWorkspaceSchema = z.object({
  key: z.string(),
  name: z.string()
})

/** The icon the Workspaces sidebar shows for a project; an arm this build does not know reads as none. */
const BotTeamProjectIconSchema = z
  .union([
    z.object({ type: z.literal('lucide'), name: z.string() }),
    z.object({ type: z.literal('emoji'), emoji: z.string() }),
    z.object({
      type: z.literal('image'),
      src: z.string(),
      source: z.enum(['upload', 'file', 'favicon', 'github']),
      label: z.string().optional()
    })
  ])
  .optional()
  .catch(undefined)

/** A Workspaces project (a repo or a folder project) on the team's host that a bot project can link to. */
export const BotTeamLinkableWorkspaceSchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(['git', 'folder']),
  // Optional: a host from before project icons omits it, and a project without one shows the default.
  icon: BotTeamProjectIconSchema
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
  workspace: BotTeamProjectWorkspaceSchema.nullable().optional(),
  // Optional: a host from before shared projects omits both. Archived hides the project from lists.
  archivedAt: z.number().nullable().optional(),
  /** Teams besides the owner (teamId) that work on this project. */
  linkedTeamIds: z.array(z.string()).optional()
})

export const BotTeamProjectCreate = z.object({
  teamId: requiredString('Missing team id'),
  name: requiredString('Missing project name'),
  goal: z.string().trim().default(''),
  codeSource: BotTeamCodeSourceSchema.nullable().default(null),
  /** Optional: teams besides the owner that work on the project from the start. */
  linkedTeamIds: z.array(z.string().min(1)).optional()
})

/** `teamId` is the team acting; only the owner team may delete, archive or restore. */
export const BotTeamProjectUpdate = z.object({
  projectId: requiredString('Missing project id'),
  teamId: requiredString('Missing team id'),
  name: z.string().trim().min(1).optional(),
  goal: z.string().trim().optional(),
  /** Replaces the linked teams (never the owner). Absent leaves them as they are. */
  linkedTeamIds: z.array(z.string().min(1)).optional()
})

export const BotTeamProjectArchive = z.object({
  projectId: requiredString('Missing project id'),
  teamId: requiredString('Missing team id'),
  archived: z.boolean()
})

export const BotTeamProjectDelete = z.object({
  projectId: requiredString('Missing project id'),
  teamId: requiredString('Missing team id')
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
  createdAt: z.number().nullable().optional(),
  /** Files from the team folder the message names; absent for a message with none. */
  attachments: z.array(BotTeamRoomAttachmentSchema).optional(),
  /** Set when another team's bot reports a finished request here; absent for a message of this room. */
  fromTeamId: z.string().optional()
})

/** A task another team took for a request this team sent, with the message that asked for it. */
export const BotTeamSentRequestSchema = z.object({
  task: BotTeamTaskSchema,
  messageId: z.string().nullable()
})
export type BotTeamSentRequest = z.infer<typeof BotTeamSentRequestSchema>

export const BotTeamTaskCreate = z.object({
  teamId: requiredString('Missing team id'),
  title: requiredString('Missing task title'),
  prompt: z.string().trim().default(''),
  ownerBotId: requiredString('Missing bot id')
})

const BotTeamPrototypeChoiceSchema = z.object({
  count: z.number().int().min(1).max(4),
  designSystem: z.enum(['use', 'propose', 'skip']).optional()
})

export const BotTeamMessagePost = z
  .object({
    teamId: requiredString('Missing team id'),
    // Empty only with files; an older host still requires text, so a client may send the file names.
    text: requiredStringAllowingEmpty('Missing message text'),
    /** False saves the task to Todo without starting a bot. */
    start: z.boolean().default(true),
    /** Only a client that can show the project question sends true; an older one never gets the question. */
    askProject: z.boolean().optional(),
    /** One id per send, reused when the client retries that send: the host then posts it once. */
    clientRequestId: z.string().min(1).max(100).optional(),
    /** Files the person added from the team folder's attachments; only a client the host admits sends them. */
    attachments: z
      .array(BotTeamRoomAttachmentSchema)
      .max(BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
      .optional(),
    /** The sender's IANA zone, so "mañana a las 10" is read on their clock. An older client sends none. */
    timeZone: z.string().min(1).max(64).optional(),
    /** The prototype count the person chose on the card; an older host ignores it and sends the text as typed. */
    prototypeChoice: BotTeamPrototypeChoiceSchema.optional()
  })
  .refine((value) => value.text.trim() !== '' || (value.attachments?.length ?? 0) > 0, {
    message: 'Missing message text',
    path: ['text']
  })

/** Files a request the room could not place by itself: to a bot, and to a team when `toTeamId` is set. */
export const BotTeamRequestAssign = z
  .object({
    teamId: requiredString('Missing team id'),
    /** Empty only with files: the answer to the project question for a message of only files. */
    text: requiredStringAllowingEmpty('Missing request text'),
    /** Absent: the least busy bot of the receiving team takes it. */
    botId: z.string().min(1).optional(),
    toTeamId: z.string().min(1).optional(),
    start: z.boolean().default(true),
    /** The answer to the project question: a project of the team, or null for none. Absent until asked. */
    projectId: z.string().min(1).nullable().optional(),
    /** The other bots a composite task has parts for, as the question carried them. */
    alsoNeeds: z.array(z.string().min(1)).optional(),
    later: z.boolean().optional(),
    askProject: z.boolean().optional(),
    /** Files the person attached to the request, kept when a choice card answers it. */
    attachments: z
      .array(BotTeamRoomAttachmentSchema)
      .max(BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
      .optional(),
    /** The sender's IANA zone, so a day the request names is read on their clock. An older client sends none. */
    timeZone: z.string().min(1).max(64).optional(),
    /** The prototype count the person chose before the room asked this question; an older host ignores it. */
    prototypeChoice: BotTeamPrototypeChoiceSchema.optional()
  })
  .refine((value) => value.text.trim() !== '' || (value.attachments?.length ?? 0) > 0, {
    message: 'Missing request text',
    path: ['text']
  })

/** Gives an idle task to a bot of any team; its team follows the bot. Nothing starts: Start does that. */
export const BotTeamTaskReassign = z.object({
  taskId: requiredString('Missing task id'),
  botId: requiredString('Missing bot id')
})

export const BotTeamRoomSelector = z.object({
  teamId: requiredString('Missing team id'),
  /** Makes the team folder when it is missing, as the first attached file needs; a plain read never does. */
  ensure: z.boolean().optional()
})

/** Only a client that understands shared and archived projects asks for them. */
export const BotTeamRoomListSelector = BotTeamRoomSelector.extend({
  withLinkedProjects: z.boolean().optional()
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
  attachments?: BotTeamRoomAttachment[]
}
