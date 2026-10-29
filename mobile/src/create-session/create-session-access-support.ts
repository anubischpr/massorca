import type {
  AgentSessionAccessMode,
  AgentSessionPermissionPreset
} from '../../../src/shared/agent-session-access-mode'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'

export type CreateSessionAccessSupport = {
  modes: readonly AgentSessionAccessMode[]
  presets: readonly AgentSessionPermissionPreset[]
}

/**
 * The access modes a new chat of an agent can start in. Before a session exists the phone has no
 * way to ask the host (`agentSession.agents` is not on the mobile allowlist and `agentSession.options`
 * needs a session), so this mirrors the shipped provider declarations, and the test beside it
 * reads those files to catch drift. An agent not listed here offers no access choice: a mode the
 * host does not declare throws after the worktree exists, and the chat negotiates the rest once it
 * is open.
 */
const SUPPORT_BY_AGENT: Readonly<Record<string, CreateSessionAccessSupport>> = {
  claude: { modes: ['default', 'full-access'], presets: ['auto', 'accept-edits', 'plan'] },
  codex: { modes: ['default', 'full-access'], presets: ['auto', 'read-only'] },
  antigravity: { modes: ['default', 'full-access'], presets: ['auto', 'accept-edits', 'plan'] }
}

/** Gentle Shell's create carries only the two legacy modes, so its `auto` preset is left out. */
const GENTLE_SHELL_SUPPORT: CreateSessionAccessSupport = {
  modes: ['default', 'full-access'],
  presets: []
}

/** Stock Pi runs full access only, so there is no choice to offer and no access picker. */
export function createSessionAccessSupport(
  agent: string | null,
  piRuntime: PiRuntimeSelection | null = null
): CreateSessionAccessSupport | null {
  if (agent === 'pi') {
    return piRuntime === 'gentle-shell' ? GENTLE_SHELL_SUPPORT : null
  }
  return (agent && SUPPORT_BY_AGENT[agent]) || null
}
