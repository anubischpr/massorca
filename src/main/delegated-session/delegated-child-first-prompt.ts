// A delegated child's first prompt: when its task asks for a prototype, the request is made for the
// child, and its hidden instruction goes after the task body, where the chat title never reads it.
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../shared/rpc-contract/prototype-params'
import { sanitizePrototypeCountSetting } from '../../shared/prototype-count-setting'
import { neutralizePrototypeMarkers } from '../../shared/prototype-hidden-instruction'
import {
  buildPrototypeRequestParts,
  classifyPrototypeRequest,
  PROTOTYPE_AGENTS,
  type PrototypeAgent
} from '../../shared/prototype-request'
import type { WorkerFirstPrompt } from '../runtime/rpc/methods/orchestration/worker/worker-start-readiness-settlement'

export type DelegatedChildChat = {
  launchDirectory: string | undefined
  workspaceId: string
}

export type DelegatedChildRequest =
  | { ok: true; requestId: string; folderPath: string }
  | { ok: false; error: string }

export type DelegatedChildFirstPromptDeps = {
  /** The child's chat record on this host; null when this host does not hold it. */
  readChat: (sessionId: string) => DelegatedChildChat | null
  /** The saved Settings value for the prototype count, unsanitized. */
  readPrototypeCount: () => unknown
  /** Makes the child's request folder and manifest; the caller supplies the state directory and clock. */
  createRequest: (input: {
    sessionId: string
    launchDirectory: string | undefined
    worktreeId: string
    originSessionId: string
    agent: PrototypeAgent
    count: number
    text: string
  }) => Promise<DelegatedChildRequest>
  removeFolder: (folderPath: string) => Promise<void>
}

export type DelegatedChildPromptInput = {
  childSessionId: string
  originSessionId: string
  /** The child's task spec, which stays as stored; only the delivered first prompt changes. */
  taskSpec: string
  /** The agent id the child runs on; one without a prototype agent asks as 'other'. */
  childAgent: string
}

/** The first prompt for a child whose task asks for a prototype, or null to deliver the task spec as stored. */
export async function delegatedChildFirstPrompt(
  input: DelegatedChildPromptInput,
  deps: DelegatedChildFirstPromptDeps
): Promise<WorkerFirstPrompt | null> {
  if (input.taskSpec.length > PROTOTYPE_PROMPT_MAX_LENGTH) {
    return null
  }
  const agent = prototypeAgentOfChild(input.childAgent)
  const text = neutralizePrototypeMarkers(input.taskSpec)
  if (classifyPrototypeRequest(text, agent).kind === 'none') {
    return null
  }
  const chat = deps.readChat(input.childSessionId)
  if (chat === null) {
    return null
  }
  const count = sanitizePrototypeCountSetting(deps.readPrototypeCount()).count
  const created = await deps
    .createRequest({
      sessionId: input.childSessionId,
      launchDirectory: chat.launchDirectory,
      worktreeId: chat.workspaceId,
      originSessionId: input.originSessionId,
      agent,
      count,
      text: input.taskSpec
    })
    .catch((error: unknown): DelegatedChildRequest => ({ ok: false, error: String(error) }))
  if (!created.ok) {
    console.warn(
      `[delegated-session] prototype request not made for child ${input.childSessionId}: ${created.error}`
    )
    return null
  }
  const folderPath = created.folderPath
  const discard = (): Promise<void> => deps.removeFolder(folderPath)
  try {
    const parts = buildPrototypeRequestParts({
      text: input.taskSpec,
      agent,
      count,
      requestId: created.requestId,
      folderPath,
      designSystem: 'use'
    })
    return { body: parts.body, appendix: parts.hidden, discard }
  } catch (error) {
    console.warn(
      `[delegated-session] prototype instruction not built for child ${input.childSessionId}: ${String(error)}`
    )
    await discard().catch(() => undefined)
    return null
  }
}

/** The prototype agent a child runs as; an agent without one of its own is 'other'. */
export function prototypeAgentOfChild(childAgent: string): PrototypeAgent {
  return isPrototypeAgent(childAgent) ? childAgent : 'other'
}

function isPrototypeAgent(value: string): value is PrototypeAgent {
  const agents: readonly string[] = PROTOTYPE_AGENTS
  return agents.includes(value)
}
