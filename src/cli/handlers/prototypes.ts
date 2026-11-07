import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from '../../shared/prototype-count-setting'
import { PROTOTYPE_DESIGN_SYSTEM_MODES } from '../../shared/prototype-design-system-files'
import { PROTOTYPE_AGENTS } from '../../shared/prototype-request'
import {
  PROTOTYPE_ATTACHMENT_MAX_BYTES,
  type CreatePrototypeRequestResult,
  type ListPrototypeSetsResult,
  type PrototypeListedSet,
  type ReadPrototypeFileResult,
  type RestorePrototypeVersionResult,
  type WriteAttachmentResult
} from '../../shared/rpc-contract/prototype-params'
import { PROTOTYPES_DESIGN_SYSTEM_HANDLERS } from './prototypes-design-system'
import {
  getOptionalEnumFlag,
  getRequiredVersionFlag,
  getSessionAndRequest,
  prototypeRefusal
} from './prototypes-input'

type RequestOutcome = { ok: true } | { ok: false; error: string }

function formatSet(set: PrototypeListedSet): string {
  const title = set.title ?? set.chatTitle ?? 'Untitled set'
  const archived = set.archived === true ? '  archived' : ''
  return `${title}  request ${set.requestId}  chat ${set.sessionId}  ${set.agent}${archived}`
}

function formatSets(result: ListPrototypeSetsResult): string {
  if (result.sets.length === 0) {
    return 'No prototype sets.'
  }
  return result.sets.map(formatSet).join('\n')
}

function getRequiredCount(flags: Map<string, string | boolean>): number {
  const count = Number(getRequiredStringFlag(flags, 'count'))
  if (!Number.isInteger(count) || count < PROTOTYPE_COUNT_MIN || count > PROTOTYPE_COUNT_MAX) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--count must be a whole number from ${PROTOTYPE_COUNT_MIN} to ${PROTOTYPE_COUNT_MAX}.`
    )
  }
  return count
}

function requestOutcomeHandler(method: string, action: string, done: string): CommandHandler {
  return async (ctx) => {
    const response = await ctx.client.call<RequestOutcome>(method, getSessionAndRequest(ctx.flags))
    if (!response.result.ok) {
      throw prototypeRefusal(action, response.result.error)
    }
    printResult(response, ctx.json, () => `${done} request ${ctx.flags.get('request')}.`)
  }
}

async function createRequest(ctx: HandlerContext): Promise<void> {
  const { flags } = ctx
  const agent = getOptionalEnumFlag(flags, 'agent', PROTOTYPE_AGENTS)
  if (agent === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Missing required --agent. Use ${PROTOTYPE_AGENTS.join(', ')}.`
    )
  }
  const worktreeId = getOptionalStringFlag(flags, 'worktree')
  const chatTitle = getOptionalStringFlag(flags, 'chat-title')
  const designSystem = getOptionalEnumFlag(flags, 'design-system', PROTOTYPE_DESIGN_SYSTEM_MODES)
  const response = await ctx.client.call<CreatePrototypeRequestResult>('prototypes.createRequest', {
    sessionId: getRequiredStringFlag(flags, 'session'),
    agent,
    originalPrompt: getRequiredStringFlag(flags, 'prompt'),
    count: getRequiredCount(flags),
    ...(worktreeId === undefined ? {} : { worktreeId }),
    ...(chatTitle === undefined ? {} : { chatTitle }),
    ...(designSystem === undefined ? {} : { designSystem })
  })
  const reply = response.result
  if (!reply.ok) {
    throw prototypeRefusal('Creating the prototype request', reply.error)
  }
  printResult(
    response,
    ctx.json,
    () => `Created request ${reply.requestId}\nFolder: ${reply.folderPath}`
  )
}

async function restoreVersion(ctx: HandlerContext): Promise<void> {
  const { flags } = ctx
  const letter = getRequiredStringFlag(flags, 'letter')
  if (!/^[A-Z]$/u.test(letter)) {
    throw new RuntimeClientError('invalid_argument', '--letter must be one capital letter, like A.')
  }
  const version = getRequiredVersionFlag(flags)
  const response = await ctx.client.call<RestorePrototypeVersionResult>(
    'prototypes.restoreVersion',
    { ...getSessionAndRequest(flags), letter, version }
  )
  const reply = response.result
  if (!reply.ok) {
    throw prototypeRefusal('Restoring the version', reply.error)
  }
  printResult(
    response,
    ctx.json,
    () =>
      `Restored direction ${letter} version ${version} as ${reply.fileName} (version ${reply.version}).`
  )
}

function readScreenshot(cwd: string, image: string): string {
  let bytes: Buffer
  try {
    bytes = readFileSync(resolve(cwd, image))
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable'
    throw new RuntimeClientError('invalid_argument', `--image could not be read: ${reason}`)
  }
  if (bytes.length === 0 || bytes.length > PROTOTYPE_ATTACHMENT_MAX_BYTES) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--image must be a PNG of 1 to ${PROTOTYPE_ATTACHMENT_MAX_BYTES} bytes.`
    )
  }
  return bytes.toString('base64')
}

async function writeAttachment(ctx: HandlerContext): Promise<void> {
  const { flags } = ctx
  const name = getRequiredStringFlag(flags, 'name')
  const pngBase64 = readScreenshot(ctx.cwd, getRequiredStringFlag(flags, 'image'))
  const response = await ctx.client.call<WriteAttachmentResult>('prototypes.writeAttachment', {
    ...getSessionAndRequest(flags),
    name,
    pngBase64
  })
  const reply = response.result
  if (!reply.ok) {
    throw prototypeRefusal('Writing the screenshot', reply.error)
  }
  printResult(response, ctx.json, () => `Wrote ${reply.path}`)
}

async function readRequestFile(ctx: HandlerContext): Promise<void> {
  const response = await ctx.client.call<ReadPrototypeFileResult>('prototypes.readFile', {
    ...getSessionAndRequest(ctx.flags),
    fileName: getRequiredStringFlag(ctx.flags, 'file')
  })
  const reply = response.result
  if (!reply.ok) {
    throw prototypeRefusal('Reading the file', reply.error)
  }
  printResult(response, ctx.json, () => reply.html)
}

export const PROTOTYPES_HANDLERS: Record<string, CommandHandler> = {
  'prototypes list': async (ctx) => {
    // Why: an empty or valueless --worktree must fail, not widen silently to every set.
    const worktreeId = ctx.flags.has('worktree')
      ? getRequiredStringFlag(ctx.flags, 'worktree')
      : undefined
    const result = await ctx.client.call<ListPrototypeSetsResult>(
      'prototypes.list',
      worktreeId === undefined ? {} : { worktreeId }
    )
    printResult(result, ctx.json, formatSets)
  },
  'prototypes create': createRequest,
  'prototypes archive': requestOutcomeHandler('prototypes.archive', 'Archiving', 'Archived'),
  'prototypes unarchive': requestOutcomeHandler(
    'prototypes.unarchive',
    'Unarchiving',
    'Unarchived'
  ),
  'prototypes rm': requestOutcomeHandler('prototypes.delete', 'Deleting', 'Deleted'),
  'prototypes restore-version': restoreVersion,
  'prototypes write-attachment': writeAttachment,
  'prototypes read-file': readRequestFile,
  ...PROTOTYPES_DESIGN_SYSTEM_HANDLERS
}
