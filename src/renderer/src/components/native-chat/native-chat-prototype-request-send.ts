// Turns a prototype request into the message the agent receives: the host makes the request
// folder, and the instruction pointing at it rides hidden behind what the user typed.
import {
  PROTOTYPE_PROMPT_MAX_LENGTH,
  type CreatePrototypeRequestParams
} from '../../../../shared/rpc-contract/prototype-params'
import {
  buildPrototypeRequestMessage,
  isUsablePrototypeRequestFolder,
  type PrototypeAgent
} from '../../../../shared/prototype-request'
import {
  PrototypeHostOutdatedError,
  createPrototypeRequestOnHost
} from '@/runtime/runtime-prototype-client'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'

// The local host's call has no timeout of its own, so a send gives up after this long and the
// next press is not held behind it.
const HOST_REQUEST_DEADLINE_MS = 20_000

function describeTarget(target: RuntimeClientTarget): string {
  return target.kind === 'local' ? 'local host' : `runtime ${target.environmentId}`
}

/** The text to send: the typed text unchanged when the host cannot make a request folder. */
export async function prepareNativeChatPrototypeText(input: {
  target: RuntimeClientTarget
  sessionId: string
  worktreeId?: string
  agent: PrototypeAgent
  text: string
  count: number
}): Promise<string> {
  const { text } = input
  if (text.length > PROTOTYPE_PROMPT_MAX_LENGTH) {
    console.warn(
      `[prototypes] request skipped for chat ${input.sessionId}: the message is longer than ${PROTOTYPE_PROMPT_MAX_LENGTH} characters`
    )
    return text
  }
  const params: CreatePrototypeRequestParams = {
    sessionId: input.sessionId,
    agent: input.agent,
    originalPrompt: text,
    count: input.count,
    ...(input.worktreeId ? { worktreeId: input.worktreeId } : {})
  }
  const created = await withDeadline(
    createPrototypeRequestOnHost(input.target, params),
    HOST_REQUEST_DEADLINE_MS
  ).catch((error) => {
    if (error instanceof PrototypeHostOutdatedError) {
      console.warn(
        `[prototypes] request skipped for chat ${input.sessionId}: the host does not support prototypes (${describeTarget(input.target)})`
      )
      return null
    }
    console.warn(
      `[prototypes] request failed for chat ${input.sessionId} (${describeTarget(input.target)}): ${String(error)}`
    )
    throw error
  })
  if (!created?.ok) {
    if (created) {
      console.warn(
        `[prototypes] request not created for chat ${input.sessionId} (${describeTarget(input.target)}): ${created.error}`
      )
    }
    return text
  }
  if (!isUsablePrototypeRequestFolder(created.requestId, created.folderPath)) {
    console.warn(
      `[prototypes] request not used for chat ${input.sessionId} (${describeTarget(input.target)}): the host named no usable request folder`
    )
    return text
  }
  return buildPrototypeRequestMessage({
    text,
    agent: input.agent,
    count: input.count,
    requestId: created.requestId,
    folderPath: created.folderPath
  }).sentText
}

/** Rejects once `ms` passes without `promise` settling. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer from the host within ${ms} ms`)), ms)
  })
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer))
}
