import { z } from 'zod'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from '../prototype-count-setting'
import { PROTOTYPE_AGENTS } from '../prototype-request'
import { REQUEST_ID_PATTERN } from '../prototype-sets'
import { SessionId } from './structured-agent-session-identifiers'

// `prototypes.*`: the host's prototype requests, read on the host that owns the chats. Additive and
// optional: an older host answers `method_not_found`, which clients read as "unsupported". The host
// resolves every folder from its own state directory; a client names a session, a request and a
// file name, never a path.

/** Longest prompt a request records; the hidden instruction is added on top of it. */
export const PROTOTYPE_PROMPT_MAX_LENGTH = 65_536
const TEXT_MAX_LENGTH = 512
/** Longest file name a read names, in characters: a request file or a Gentle Shell artboard path. */
const FILE_NAME_MAX_LENGTH = 512

export const CreatePrototypeRequestParams = z
  .object({
    sessionId: SessionId,
    agent: z.enum(PROTOTYPE_AGENTS),
    originalPrompt: z.string().min(1).max(PROTOTYPE_PROMPT_MAX_LENGTH),
    count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX),
    worktreeId: z.string().min(1).max(TEXT_MAX_LENGTH).optional(),
    chatTitle: z.string().max(TEXT_MAX_LENGTH).optional()
  })
  .strict()

export type CreatePrototypeRequestParams = z.infer<typeof CreatePrototypeRequestParams>

export const ListPrototypeSetsParams = z
  .object({
    worktreeId: z.string().min(1).max(TEXT_MAX_LENGTH).optional()
  })
  .strict()

export type ListPrototypeSetsParams = z.infer<typeof ListPrototypeSetsParams>

export const ReadPrototypeFileParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    fileName: z.string().min(1).max(FILE_NAME_MAX_LENGTH)
  })
  .strict()

export type ReadPrototypeFileParams = z.infer<typeof ReadPrototypeFileParams>

/** Why a request folder cannot be made: the chat has no visuals folder on this host. */
export const PROTOTYPE_CREATE_REQUEST_ERRORS = ['unsupported'] as const

export type CreatePrototypeRequestResult =
  | { ok: true; requestId: string; folderPath: string }
  | { ok: false; error: (typeof PROTOTYPE_CREATE_REQUEST_ERRORS)[number] }

/** Why a set file cannot be shown. Anything else the host reports is read as `unreadable`. */
export const PROTOTYPE_READ_FILE_ERRORS = ['not_found', 'too_large', 'unreadable'] as const

export type PrototypeReadFileError = (typeof PROTOTYPE_READ_FILE_ERRORS)[number]

export type ReadPrototypeFileResult =
  | { ok: true; html: string }
  | { ok: false; error: PrototypeReadFileError }

export const PrototypeListedVersionSchema = z.object({
  version: z.int().min(1),
  fileName: z.string(),
  /** Last write of the file, in milliseconds since the epoch. */
  mtime: z.number()
})

export const PrototypeListedDirectionSchema = z.object({
  letter: z.string().length(1),
  versions: z.array(PrototypeListedVersionSchema)
})

export type PrototypeListedDirection = z.infer<typeof PrototypeListedDirectionSchema>

/** One request's directions, with the manifest's metadata the lists group and filter by. */
export const PrototypeListedSetSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  agent: z.enum(PROTOTYPE_AGENTS),
  worktreeId: z.string().nullable(),
  chatTitle: z.string().nullable(),
  originalPrompt: z.string(),
  createdAt: z.string(),
  count: z.int(),
  directions: z.array(PrototypeListedDirectionSchema)
})

export type PrototypeListedSet = z.infer<typeof PrototypeListedSetSchema>

export type ListPrototypeSetsResult = { sets: PrototypeListedSet[] }
