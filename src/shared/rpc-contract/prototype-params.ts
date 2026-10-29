import { z } from 'zod'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from '../prototype-count-setting'
import { PROTOTYPE_DESIGN_SYSTEM_MODES } from '../prototype-design-system-files'
import { DESIGN_SYSTEM_SWATCH_MAX_LENGTH } from '../prototype-design-system-summary'
import { PROTOTYPE_AGENTS } from '../prototype-request'
import { DIRECTION_LETTER_PATTERN } from '../prototype-request-folder'
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
/** Longest name and tradeoff the agent may give a direction in directions.json. */
export const PROTOTYPE_DIRECTION_NAME_MAX_LENGTH = 80
export const PROTOTYPE_DIRECTION_TRADEOFF_MAX_LENGTH = 200

export const CreatePrototypeRequestParams = z
  .object({
    sessionId: SessionId,
    agent: z.enum(PROTOTYPE_AGENTS),
    originalPrompt: z.string().min(1).max(PROTOTYPE_PROMPT_MAX_LENGTH),
    count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX),
    worktreeId: z.string().min(1).max(TEXT_MAX_LENGTH).optional(),
    chatTitle: z.string().max(TEXT_MAX_LENGTH).optional(),
    /** What the request does with the project's design system; the host records it and its version. */
    designSystem: z.enum(PROTOTYPE_DESIGN_SYSTEM_MODES).optional()
  })
  .strict()

export type CreatePrototypeRequestParams = z.infer<typeof CreatePrototypeRequestParams>

export const ListPrototypeSetsParams = z
  .object({
    worktreeId: z.string().min(1).max(TEXT_MAX_LENGTH).optional()
  })
  .strict()

export type ListPrototypeSetsParams = z.infer<typeof ListPrototypeSetsParams>

export const ReadPrototypeDesignSystemParams = z.object({ sessionId: SessionId }).strict()

export type ReadPrototypeDesignSystemParams = z.infer<typeof ReadPrototypeDesignSystemParams>

export const ReadPrototypeFileParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    fileName: z.string().min(1).max(FILE_NAME_MAX_LENGTH)
  })
  .strict()

export type ReadPrototypeFileParams = z.infer<typeof ReadPrototypeFileParams>

/**
 * Why a request folder is not made. `unsupported`: the chat has no record on this host, or is not
 * local to it, so it has no visuals folder here. `unwritable`: the host could not write the folder,
 * and any partial folder is removed. An older host answers `method_not_found` instead, which is a
 * host that predates prototypes, not a verdict on the chat.
 */
export const PROTOTYPE_CREATE_REQUEST_ERRORS = ['unsupported', 'unwritable'] as const

export type CreatePrototypeRequestResult =
  | { ok: true; requestId: string; folderPath: string }
  | { ok: false; error: (typeof PROTOTYPE_CREATE_REQUEST_ERRORS)[number] }

/**
 * The design system of a chat's project, as files read under the project root on the host. Each file
 * is absent when the project has none; `fileNames` lists the ones read, relative to the project root.
 * `unreadableFileNames` lists the ones the project has but the host refused to read (over the size cap,
 * not text, or a path it does not follow). `not_found`: no such chat on this host, or it is not local.
 */
export type ReadPrototypeDesignSystemResult =
  | {
      ok: true
      projectKey: string
      projectName: string
      fileNames: string[]
      tokensJson?: string
      componentsHtml?: string
      systemMd?: string
      unreadableFileNames?: string[]
    }
  | { ok: false; error: 'not_found' }

/**
 * Why a set file cannot be shown: `not_found` for a file that is not this request's (including a chat
 * this host does not keep locally), `too_large` over the byte cap. Anything else the host reports is
 * read as `unreadable`.
 */
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
  letter: z.string().regex(DIRECTION_LETTER_PATTERN),
  versions: z.array(PrototypeListedVersionSchema),
  /** The short name and one-line tradeoff the agent wrote in directions.json, when it did. */
  name: z.string().min(1).max(PROTOTYPE_DIRECTION_NAME_MAX_LENGTH).optional(),
  tradeoff: z.string().min(1).max(PROTOTYPE_DIRECTION_TRADEOFF_MAX_LENGTH).optional()
})

export type PrototypeListedDirection = z.infer<typeof PrototypeListedDirectionSchema>

/** The design system of one project: what a list row or request card shows without reading its files. */
export const PrototypeListedDesignSystemSchema = z.object({
  projectKey: z.string().min(1).max(TEXT_MAX_LENGTH),
  projectName: z.string().min(1).max(TEXT_MAX_LENGTH),
  status: z.enum(['detected', 'proposed']),
  version: z.int().min(1),
  tokenCount: z.int().min(0),
  agent: z.string().max(80).optional(),
  /** Color values, up to four, for the list icon. */
  swatches: z.array(z.string().max(DESIGN_SYSTEM_SWATCH_MAX_LENGTH)).max(4)
})

export type PrototypeListedDesignSystem = z.infer<typeof PrototypeListedDesignSystemSchema>

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
  /** The request folder on the host, absolute; a client quotes it in an iteration instruction. */
  folderPath: z.string().min(1).optional(),
  /** The project the chat works in, as the host resolved it; absent from a host that predates design systems. */
  projectKey: z.string().min(1).max(TEXT_MAX_LENGTH).optional(),
  projectName: z.string().min(1).max(TEXT_MAX_LENGTH).optional(),
  /** The design system version the request was built on, when it recorded one. */
  builtOn: z.int().min(1).optional(),
  directions: z.array(PrototypeListedDirectionSchema)
})

export type PrototypeListedSet = z.infer<typeof PrototypeListedSetSchema>

export type ListPrototypeSetsResult = {
  sets: PrototypeListedSet[]
  designSystems?: PrototypeListedDesignSystem[]
}

/** A note screenshot's base name: one plain segment, so the file sits directly in the request's notes/ folder. */
export const PROTOTYPE_ATTACHMENT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u
/** Largest decoded note screenshot the host writes. */
export const PROTOTYPE_ATTACHMENT_MAX_BYTES = 1_500_000
/** The base64 text of a screenshot at the byte cap, in whole four-character groups. */
export const PROTOTYPE_ATTACHMENT_MAX_BASE64_LENGTH =
  Math.ceil(PROTOTYPE_ATTACHMENT_MAX_BYTES / 3) * 4

/** One note screenshot, written into the request's notes/ folder on the host that owns the chat. */
export const WriteAttachmentParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    name: z.string().regex(PROTOTYPE_ATTACHMENT_NAME_PATTERN),
    pngBase64: z.string().min(1).max(PROTOTYPE_ATTACHMENT_MAX_BASE64_LENGTH)
  })
  .strict()

export type WriteAttachmentParams = z.infer<typeof WriteAttachmentParams>

/** Why a note screenshot is not written. */
export const PROTOTYPE_WRITE_ATTACHMENT_ERRORS = [
  'unsupported',
  'too_large',
  'invalid',
  'unwritable'
] as const

export type WriteAttachmentResult =
  | { ok: true; path: string }
  | { ok: false; error: (typeof PROTOTYPE_WRITE_ATTACHMENT_ERRORS)[number] }

// Each reply as a client checks it, so every platform reads one host answer the same way.
export const CreatePrototypeRequestReplySchema = z.union([
  z.object({ ok: z.literal(true), requestId: z.string(), folderPath: z.string() }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_CREATE_REQUEST_ERRORS) })
])

export const ListPrototypeSetsReplySchema = z.object({
  sets: z.array(PrototypeListedSetSchema),
  designSystems: z.array(PrototypeListedDesignSystemSchema).optional()
})

export const ReadPrototypeDesignSystemReplySchema = z.union([
  z.object({
    ok: z.literal(true),
    projectKey: z.string().min(1),
    projectName: z.string().min(1),
    fileNames: z.array(z.string()),
    tokensJson: z.string().optional(),
    componentsHtml: z.string().optional(),
    systemMd: z.string().optional(),
    unreadableFileNames: z.array(z.string()).optional()
  }),
  z.object({ ok: z.literal(false), error: z.literal('not_found') })
])

export const ReadPrototypeFileReplySchema = z.union([
  z.object({ ok: z.literal(true), html: z.string() }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_READ_FILE_ERRORS) })
])

export const WriteAttachmentReplySchema = z.union([
  z.object({ ok: z.literal(true), path: z.string().min(1) }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_WRITE_ATTACHMENT_ERRORS) })
])
