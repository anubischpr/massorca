// The create-time check each structured registration runs: whether its CLI resolves on this host
// the way the launch itself resolves it, so the agent picker never offers an absent CLI.

import type { TuiAgent } from '../../shared/tui-agent'
import type { AcpLaunchSpec } from '../acp/acp-launch-specs'
import {
  acpLaunchVersionSupported,
  resolveAcpLaunchCommand
} from '../acp/acp-structured-launch-resolution'
import { isAgentSessionPreSpawnError } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import {
  resolveStructuredAgentCommand,
  structuredCliInstalled,
  structuredLaunchResolutionOptions
} from '../native-chat/structured-agent-command-resolution'
import type { StructuredAgentRuntimeRegistration } from './structured-agent-runtime-registrations'

type LaunchCheck = NonNullable<StructuredAgentRuntimeRegistration['supportsLaunch']>

/** A CLI the launch resolves with its Command setting and environment, probed for the same file. */
export function structuredCliLaunchCheck(agent: TuiAgent): LaunchCheck {
  return async ({ env, commandSettings }) =>
    structuredCliInstalled(() =>
      resolveStructuredAgentCommand(agent, commandSettings, structuredLaunchResolutionOptions(env))
    )
}

/** An ACP agent's create check: its launch command resolves, and where it names releases, one
 *  of them answers `--version`. */
export function acpLaunchCheck(spec: AcpLaunchSpec): LaunchCheck {
  return async ({ cwd, env, commandSettings }) => {
    const launchEnv = { ...env, ...spec.env }
    const resolve = () => resolveAcpLaunchCommand(spec, launchEnv, { commandSettings })
    if (!spec.supportsVersion) {
      return structuredCliInstalled(resolve)
    }
    let command: string
    try {
      command = resolve()
    } catch (error) {
      // An unrunnable Command setting is the launch's refusal to state, not a terminal.
      if (isAgentSessionPreSpawnError(error)) {
        return true
      }
      throw error
    }
    return acpLaunchVersionSupported(spec, { command, cwd, env: launchEnv })
  }
}
