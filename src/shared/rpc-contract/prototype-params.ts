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

/** A chat, or for this desktop and its CLI only, an absolute folder of the project; exactly one. */
export const ReadPrototypeDesignSystemParams = z
  .object({ sessionId: SessionId.optional(), projectPath: z.string().min(1).max(4096).optional() })
  .strict()
  .refine((params) => (params.sessionId === undefined) !== (params.projectPath === undefined), {
    message: 'Name a chat or a project folder, not both.'
  })

export type ReadPrototypeDesignSystemParams = z.infer<typeof ReadPrototypeDesignSystemParams>

/** One request of one chat: the target of an archive, an unarchive or a delete. Never a path. */
export const PrototypeRequestTargetParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN)
  })
  .strict()

export type PrototypeRequestTargetParams = z.infer<typeof PrototypeRequestTargetParams>

/** One design system's saved versions, addressed by a chat as `prototypes.readDesignSystem` is. */
export const ListDesignSystemVersionsParams = z.object({ sessionId: SessionId }).strict()

export type ListDesignSystemVersionsParams = z.infer<typeof ListDesignSystemVersionsParams>

export const ReadDesignSystemVersionParams = z
  .object({ sessionId: SessionId, version: z.int().min(1).max(10_000) })
  .strict()

export type ReadDesignSystemVersionParams = z.infer<typeof ReadDesignSystemVersionParams>

export const RestoreDesignSystemVersionParams = z
  .object({ sessionId: SessionId, version: z.int().min(1).max(10_000) })
  .strict()

export type RestoreDesignSystemVersionParams = z.infer<typeof RestoreDesignSystemVersionParams>

export const ReadPrototypeFileParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    fileName: z.string().min(1).max(FILE_NAME_MAX_LENGTH)
  })
  .strict()

export type ReadPrototypeFileParams = z.infer<typeof ReadPrototypeFileParams>

/** Copies one direction's earlier version into its next version; an older host answers `method_not_found`. */
export const RestorePrototypeVersionParams = z
  .object({
    sessionId: SessionId,
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    letter: z.string().regex(/^[A-Z]$/),
    version: z.int().min(1).max(10_000)
  })
  .strict()

export type RestorePrototypeVersionParams = z.infer<typeof RestorePrototypeVersionParams>

/**
 * Why a version is not restored. `not_found`: no such request, direction or version this caller may
 * touch; `conflict`: another write took the next version number first; `unwritable`: the host could
 * not read the version or write the new one. Nothing is ever overwritten or removed.
 */
export const PROTOTYPE_RESTORE_VERSION_ERRORS = ['not_found', 'conflict', 'unwritable'] as const

export type RestorePrototypeVersionResult =
  | { ok: true; fileName: string; version: number }
  | { ok: false; error: (typeof PROTOTYPE_RESTORE_VERSION_ERRORS)[number] }

/**
 * One version of a design system a host can list: the history of its tokens.json, the current version and every
 * version the host saved a copy of. `saved: false` is an earlier version listed from history, which cannot be opened.
 */
export type DesignSystemVersionListed = {
  version: number
  /** When the version was made, as the agent or the restore wrote it. */
  at?: string
  saved: boolean
  current: boolean
}

/** `not_found`: no such chat on this host, or it is not local. */
export type ListDesignSystemVersionsResult =
  | { ok: true; versions: DesignSystemVersionListed[] }
  | { ok: false; error: 'not_found' }

/** The files of one saved version, the same shape a read of the current system answers with. */
export type ReadDesignSystemVersionResult = ReadPrototypeDesignSystemResult

/**
 * Why a version is not restored. `not_found`: no such chat, no design system, a version never saved, or a caller
 * that may not act; `current`: the version is already the current one; `unwritable`: the host could not write the
 * design system or its new version. A restore keeps the current version first, then makes the three known design
 * system files match the restored version, removing those it lacks. It never deletes a saved version.
 */
export const PROTOTYPE_RESTORE_DESIGN_SYSTEM_VERSION_ERRORS = [
  'not_found',
  'current',
  'unwritable'
] as const

export type RestoreDesignSystemVersionResult =
  | { ok: true; version: number }
  | { ok: false; error: (typeof PROTOTYPE_RESTORE_DESIGN_SYSTEM_VERSION_ERRORS)[number] }

/**
 * Why a request folder is not made. `unsupported`: the chat has no record on this host, or is not
 * local to it, so it has no visuals folder here. `unwritable`: the host could not write the folder,
 * and any partial folder is removed. An older host answers `method_not_found` instead, which is a
 * host that predates prototypes, not a verdict on the chat.
 */
export const PROTOTYPE_CREATE_REQUEST_ERRORS = ['unsupported', 'unwritable'] as const

export type CreatePrototypeRequestResult =
  | {
      ok: true
      requestId: string
      folderPath: string
      /** The design system folder on the host, absolute; set when the request uses a design system. */
      designSystemFolderPath?: string
    }
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
      /** The absolute design/system folder read, with the host's separators; an older host omits it. */
      folderPath?: string
      /** Root-relative entries of that folder MassOrca does not read, e.g. a tokens.css an agent wrote instead. */
      otherFileNames?: string[]
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

/** Why a set is not archived or unarchived: `not_found` is no such request this caller may touch; `unwritable`, the host could not rewrite its request.json. */
export const PROTOTYPE_ARCHIVE_ERRORS = ['not_found', 'unwritable'] as const

export type ArchivePrototypeRequestResult =
  | { ok: true }
  | { ok: false; error: (typeof PROTOTYPE_ARCHIVE_ERRORS)[number] }

/**
 * Why a set is not deleted. `not_deletable`: its chat and its worktree both still exist, or the host cannot
 * tell they are gone (a remote chat out of contact is never read as deleted). `unwritable`: the folder could
 * not be removed.
 */
export const PROTOTYPE_DELETE_ERRORS = ['not_found', 'not_deletable', 'unwritable'] as const

export type DeletePrototypeRequestResult =
  | { ok: true }
  | { ok: false; error: (typeof PROTOTYPE_DELETE_ERRORS)[number] }

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

/** The newest request that proposed a design system and has no direction files yet. */
export const PrototypeListedPendingRequestSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  agent: z.enum(PROTOTYPE_AGENTS)
})

export type PrototypeListedPendingRequest = z.infer<typeof PrototypeListedPendingRequestSchema>

/** A chat on the host, with or without a request: where a project with no request sends its design system edits. */
export const PrototypeListedChatSchema = PrototypeListedPendingRequestSchema.omit({
  requestId: true
})

export type PrototypeListedChat = z.infer<typeof PrototypeListedChatSchema>

/** The design system of one project: what a list row or request card shows without reading its files. */
export const PrototypeListedDesignSystemSchema = z.object({
  projectKey: z.string().min(1).max(TEXT_MAX_LENGTH),
  projectName: z.string().min(1).max(TEXT_MAX_LENGTH),
  status: z.enum(['detected', 'proposed']),
  version: z.int().min(1),
  tokenCount: z.int().min(0),
  agent: z.string().max(80).optional(),
  /** Color values, up to four, for the list icon. */
  swatches: z.array(z.string().max(DESIGN_SYSTEM_SWATCH_MAX_LENGTH)).max(4),
  /** The request whose directions Approve builds; absent when the project has no such request. */
  pendingRequest: PrototypeListedPendingRequestSchema.optional(),
  /** The chat of the project's newest request, of any mode and with or without a set; absent from a host that predates it. */
  newestRequest: PrototypeListedPendingRequestSchema.optional(),
  /** The newest host chat launched in the project, request or not; absent from a host that predates it. */
  chat: PrototypeListedChatSchema.optional(),
  /** The system's folder on the host, absolute; a client quotes it to the agent. Absent from a host that predates it. */
  folderPath: z.string().min(1).optional()
})

export type PrototypeListedDesignSystem = z.infer<typeof PrototypeListedDesignSystemSchema>

/** One request's directions, with the manifest's metadata the lists group and filter by. */
export const PrototypeListedSetSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  agent: z.enum(PROTOTYPE_AGENTS),
  worktreeId: z.string().nullable(),
  chatTitle: z.string().nullable(),
  /** The AI-generated short title; absent until naming finishes and on a host that predates it. */
  title: z.string().min(1).max(TEXT_MAX_LENGTH).optional(),
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
  /** The parent chat that delegated this set's request to a child session; absent for a chat's own request. */
  origin: z.object({ sessionId: z.string().min(1).max(TEXT_MAX_LENGTH) }).optional(),
  /** Set once the set is archived; absent from a host that predates archiving. */
  archived: z.literal(true).optional(),
  /**
   * Set when the host would accept `prototypes.delete` for this set: its chat or its worktree no longer
   * exists. The host decides. Hosts before pv85 list it for archived sets only.
   */
  deletable: z.literal(true).optional(),
  directions: z.array(PrototypeListedDirectionSchema)
})

export type PrototypeListedSet = z.infer<typeof PrototypeListedSetSchema>

/** A request sent with 'Propose one first', and the project it proposes a design system for. */
export const PrototypeListedProposalSchema = z.object({
  requestId: z.string(),
  projectKey: z.string().min(1).max(TEXT_MAX_LENGTH)
})

export type PrototypeListedProposal = z.infer<typeof PrototypeListedProposalSchema>

export type ListPrototypeSetsResult = {
  sets: PrototypeListedSet[]
  designSystems?: PrototypeListedDesignSystem[]
  /** Every request sent with 'Propose one first' whose project the host names; a set or not. */
  proposals?: PrototypeListedProposal[]
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
  z.object({
    ok: z.literal(true),
    requestId: z.string(),
    folderPath: z.string(),
    designSystemFolderPath: z.string().min(1).optional()
  }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_CREATE_REQUEST_ERRORS) })
])

export const ListPrototypeSetsReplySchema = z.object({
  sets: z.array(PrototypeListedSetSchema),
  designSystems: z.array(PrototypeListedDesignSystemSchema).optional(),
  proposals: z.array(PrototypeListedProposalSchema).optional()
})

export const ArchivePrototypeRequestReplySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_ARCHIVE_ERRORS) })
])

export const DeletePrototypeRequestReplySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_DELETE_ERRORS) })
])

export const ReadPrototypeDesignSystemReplySchema = z.union([
  z.object({
    ok: z.literal(true),
    projectKey: z.string().min(1),
    projectName: z.string().min(1),
    fileNames: z.array(z.string()),
    tokensJson: z.string().optional(),
    componentsHtml: z.string().optional(),
    systemMd: z.string().optional(),
    unreadableFileNames: z.array(z.string()).optional(),
    folderPath: z.string().min(1).optional(),
    otherFileNames: z.array(z.string()).optional()
  }),
  z.object({ ok: z.literal(false), error: z.literal('not_found') })
])

export const ReadPrototypeFileReplySchema = z.union([
  z.object({ ok: z.literal(true), html: z.string() }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_READ_FILE_ERRORS) })
])

export const RestorePrototypeVersionReplySchema = z.union([
  z.object({ ok: z.literal(true), fileName: z.string().min(1), version: z.int().min(2) }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_RESTORE_VERSION_ERRORS) })
])

export const DesignSystemVersionListedSchema = z.object({
  version: z.int().min(1),
  at: z.string().min(1).max(40).optional(),
  saved: z.boolean(),
  current: z.boolean()
})

export const ListDesignSystemVersionsReplySchema = z.union([
  z.object({ ok: z.literal(true), versions: z.array(DesignSystemVersionListedSchema) }),
  z.object({ ok: z.literal(false), error: z.literal('not_found') })
])

export const ReadDesignSystemVersionReplySchema = ReadPrototypeDesignSystemReplySchema

export const RestoreDesignSystemVersionReplySchema = z.union([
  z.object({ ok: z.literal(true), version: z.int().min(2) }),
  z.object({
    ok: z.literal(false),
    error: z.enum(PROTOTYPE_RESTORE_DESIGN_SYSTEM_VERSION_ERRORS)
  })
])

export const WriteAttachmentReplySchema = z.union([
  z.object({ ok: z.literal(true), path: z.string().min(1) }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_WRITE_ATTACHMENT_ERRORS) })
])
