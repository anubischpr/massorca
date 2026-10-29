// How each ACP agent receives the child-session instructions for one launch. ACP itself carries no
// system prompt, so each agent gets its own native channel, without touching the user's own config.

import { join } from 'node:path'
import type { TuiAgent } from '../../shared/tui-agent'
import {
  DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE,
  delegationInstructionsForEnv
} from '../delegated-session/delegation-agent-instructions'
import { structuredSessionChildIdentityEnv } from '../runtime/structured-session-child-identity-env'

/** What a launch adds so the agent reads the instructions: arguments and/or variables. */
export type AcpDelegationLaunch = {
  args?: string[]
  env?: Record<string, string>
}

type AcpDelegationInput = {
  /** The child's env with the Orca identity applied, plus what the launch lays over it. */
  env: Readonly<Record<string, string>>
  /** A folder holding the instructions as AGENTS.md; null when none could be written. */
  instructionsFolder: () => Promise<string | null>
}

type AcpDelegationLoader = (input: AcpDelegationInput) => Promise<AcpDelegationLaunch | null>

/** `content` (the user's own inline config, if any) with the instructions file added; null when it
 *  is not a config this can extend safely. */
export function withOpenCodeInstructionsFile(
  content: string | undefined,
  file: string
): string | null {
  let config: unknown
  try {
    config = content?.trim() ? JSON.parse(content) : {}
  } catch {
    // JSONC or a typo: rewriting it would drop the user's settings.
    return null
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return null
  }
  const instructions: unknown = 'instructions' in config ? config.instructions : []
  return Array.isArray(instructions)
    ? JSON.stringify({ ...config, instructions: [...instructions, file] })
    : null
}

/** OpenCode concatenates the inline config's `instructions` with the user's own. */
const loadOpenCodeDelegationInstructions: AcpDelegationLoader = async ({
  env,
  instructionsFolder
}) => {
  const folder = await instructionsFolder()
  const content = folder
    ? withOpenCodeInstructionsFile(env.OPENCODE_CONFIG_CONTENT, join(folder, 'AGENTS.md'))
    : null
  return content === null ? null : { env: { OPENCODE_CONFIG_CONTENT: content } }
}

/** OMP appends the text to its system prompt, beside whatever the user's own setup adds. */
const loadOmpDelegationInstructions: AcpDelegationLoader = async () => ({
  args: ['--append-system-prompt', DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE]
})

// Grok has no channel verified to reach its model other than rule files in the user's own home.
const LOADERS: Partial<Record<TuiAgent, AcpDelegationLoader>> = {
  opencode: loadOpenCodeDelegationInstructions,
  omp: loadOmpDelegationInstructions
}

/** The launch additions for `agent`, or null when this launch cannot delegate or the agent has no
 *  channel for it. Never throws. */
export async function loadAcpDelegationInstructions(
  agent: TuiAgent,
  input: {
    sessionId: string
    env: Readonly<Record<string, string>>
    instructionsFolder?: () => Promise<string | null>
  }
): Promise<AcpDelegationLaunch | null> {
  const loader = LOADERS[agent]
  if (!loader) {
    return null
  }
  const childEnv = structuredSessionChildIdentityEnv(input.sessionId, { ...input.env })
  if (!delegationInstructionsForEnv(childEnv)) {
    return null
  }
  try {
    return await loader({
      env: childEnv,
      instructionsFolder: input.instructionsFolder ?? (async () => null)
    })
  } catch {
    return null
  }
}
