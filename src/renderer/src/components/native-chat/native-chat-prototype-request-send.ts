// Turns a prototype request into the message the agent receives: the host makes the request
// folder, and the instruction pointing at it rides hidden behind what the user typed.
import {
  PROTOTYPE_PROMPT_MAX_LENGTH,
  type CreatePrototypeRequestParams
} from '../../../../shared/rpc-contract/prototype-params'
import {
  buildPrototypeRequestMessage,
  type PrototypeAgent
} from '../../../../shared/prototype-request'
import {
  PrototypeHostOutdatedError,
  createPrototypeRequestOnHost
} from '@/runtime/runtime-prototype-client'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'

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
    return text
  }
  const params: CreatePrototypeRequestParams = {
    sessionId: input.sessionId,
    agent: input.agent,
    originalPrompt: text,
    count: input.count,
    ...(input.worktreeId ? { worktreeId: input.worktreeId } : {})
  }
  const created = await createPrototypeRequestOnHost(input.target, params).catch((error) => {
    if (error instanceof PrototypeHostOutdatedError) {
      return null
    }
    throw error
  })
  if (!created?.ok) {
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
