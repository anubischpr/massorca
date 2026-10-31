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
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { PrototypeDesignSystemMode } from '../../shared/prototype-design-system-files'
import type { WorkerFirstPrompt } from '../runtime/rpc/methods/orchestration/worker/worker-start-readiness-settlement'

export type DelegatedChildChat = {
  /** The agent id the child runs on, as its chat record names it. */
  agent: string
  launchDirectory: string | undefined
  workspaceId: string
  /** The Pi runtime the child's workspace runs; set only for a Pi child. */
  piRuntime?: PiRuntimeSelection
}

export type DelegatedChildRequest =
  | { ok: true; requestId: string; folderPath: string; designSystemFolderPath?: string }
  | { ok: false; error: string }

export type DelegatedChildFirstPromptDeps = {
  /** The child's chat record on this host, with where it works; null when this host does not hold it. */
  readChat: (sessionId: string) => Promise<DelegatedChildChat | null>
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
    designSystem: PrototypeDesignSystemMode
    text: string
  }) => Promise<DelegatedChildRequest>
  removeFolder: (folderPath: string) => Promise<void>
}

export type DelegatedChildPromptInput = {
  childSessionId: string
  originSessionId: string
  /** The child's task spec, which stays as stored; only the delivered first prompt changes. */
  taskSpec: string
  /** The count the person picked on the card; absent, the Settings count applies. */
  count?: number
  /** The design system choice the person made on the card; absent, the child uses the project's system. */
  designSystem?: PrototypeDesignSystemMode
}

/** The first prompt for a child whose task asks for a prototype, or null to deliver the task spec as stored. */
/** Any read or write that throws gives the task unchanged: the child's start is never aborted for its prompt. */
export async function delegatedChildFirstPrompt(
  input: DelegatedChildPromptInput,
  deps: DelegatedChildFirstPromptDeps
): Promise<WorkerFirstPrompt | null> {
  try {
    return await buildDelegatedChildFirstPrompt(input, deps)
  } catch (error) {
    console.warn(
      `[delegated-session] first prompt not made for child ${input.childSessionId}; delivering the task spec: ${String(error)}`
    )
    return null
  }
}

async function buildDelegatedChildFirstPrompt(
  input: DelegatedChildPromptInput,
  deps: DelegatedChildFirstPromptDeps
): Promise<WorkerFirstPrompt | null> {
  if (input.taskSpec.length > PROTOTYPE_PROMPT_MAX_LENGTH) {
    return null
  }
  // Why: a Pi child's agent depends on the runtime its chat runs, so the chat is read before the task is classified.
  const chat = await deps.readChat(input.childSessionId)
  if (chat === null) {
    return null
  }
  const agent = prototypeAgentOfChild(chat.agent, chat.piRuntime)
  const text = neutralizePrototypeMarkers(input.taskSpec)
  if (classifyPrototypeRequest(text, agent).kind === 'none') {
    return null
  }
  // Why: a count the person answered on the card wins; Settings only counts for a task answered without one.
  const count = input.count ?? sanitizePrototypeCountSetting(deps.readPrototypeCount()).count
  // Why 'use' by default: a task answered without the design system choice (an older client) has nobody to
  // review a proposal, so its instruction reuses the project's system or creates one and goes on.
  const designSystem: PrototypeDesignSystemMode = input.designSystem ?? 'use'
  const created = await deps
    .createRequest({
      sessionId: input.childSessionId,
      launchDirectory: chat.launchDirectory,
      worktreeId: chat.workspaceId,
      originSessionId: input.originSessionId,
      agent,
      count,
      designSystem,
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
      designSystem,
      // Why: a person who chose 'propose' reviews the system first, as for a direct request.
      ...(designSystem === 'use' ? { designSystemUnattended: true } : {}),
      ...(created.designSystemFolderPath !== undefined
        ? { designSystemFolder: created.designSystemFolderPath }
        : {})
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

/**
 * The prototype agent a child runs as. A Pi child is Gentle Shell only when its Pi runtime says so, since
 * plain Pi has no prototype agent of its own; any other agent without one of its own is 'other'.
 */
export function prototypeAgentOfChild(
  childAgent: string,
  piRuntime?: PiRuntimeSelection
): PrototypeAgent {
  if (childAgent === 'pi') {
    return piRuntime === 'gentle-shell' ? 'gentle-shell' : 'other'
  }
  return isPrototypeAgent(childAgent) ? childAgent : 'other'
}

function isPrototypeAgent(value: string): value is PrototypeAgent {
  const agents: readonly string[] = PROTOTYPE_AGENTS
  return agents.includes(value)
}
