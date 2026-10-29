import { isAbsolute } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { TuiAgent } from '../../shared/tui-agent'
import {
  resolveCliCommand,
  resolveExecutableCommand
} from '../../shared/node-cli-command-resolution'
import {
  hasExplicitTuiLaunchCommand,
  structuredAgentCommandToken
} from '../../shared/tui-agent-launch-command-override'
import {
  AgentSessionPreSpawnError,
  isAgentSessionPreSpawnError
} from './agent-session-wire/structured-agent-session-adapter'

export type StructuredAgentCommandSettings = Partial<
  Pick<GlobalSettings, 'agentCmdOverrides' | 'agentDefaultEnv'>
>
type CommandSettings = StructuredAgentCommandSettings
type CommandOptions = NonNullable<Parameters<typeof resolveExecutableCommand>[1]>

function resolveOverride(
  agent: TuiAgent,
  settings: CommandSettings | null | undefined,
  options: CommandOptions
) {
  const token = structuredAgentCommandToken(settings?.agentCmdOverrides?.[agent] ?? '')
  const overlay = settings?.agentDefaultEnv?.[agent]
  return token
    ? resolveExecutableCommand(token, {
        ...options,
        pathEnv: options.pathEnv ?? overlay?.PATH ?? overlay?.Path
      })
    : null
}

// Windows starts .exe/.com directly and .cmd/.bat through Orca's shim handling; an extensionless
// file would fail to spawn with no word about the setting.
function spawnableOn(platform: NodeJS.Platform, command: string): boolean {
  return platform !== 'win32' || /\.(exe|com|cmd|bat)$/i.test(command)
}

/** Re-read the existing setting for every session acquisition and catalog probe. A set Command
 *  that names no runnable program refuses the start rather than quietly running the stock CLI.
 *  Without one, `stock` names the agent's own binary (the agent id by default). */
export function resolveStructuredAgentCommand(
  agent: TuiAgent,
  settings: CommandSettings,
  options: CommandOptions = {},
  stock: { command?: string; resolve?: typeof resolveCliCommand } = {}
): string {
  if (!hasExplicitTuiLaunchCommand(settings, agent)) {
    return (stock.resolve ?? resolveCliCommand)(stock.command ?? agent, options)
  }
  const command = resolveOverride(agent, settings, options)
  if (!command || !spawnableOn(options.platform ?? process.platform, command)) {
    // The value stays out of the message: a saved command line can carry a secret.
    throw new AgentSessionPreSpawnError(`the ${agent} Command setting is not a runnable program`, {
      reason: 'agentCommandNotRunnable'
    })
  }
  return command
}

/** Whether the CLI a launch spawns is installed here. An unrunnable Command setting is admitted, so
 *  the launch states its own refusal; a stock binary counts only when it resolves to a file. */
export function structuredCliInstalled(resolveCommand: () => string): boolean {
  let command: string
  try {
    command = resolveCommand()
  } catch (error) {
    if (isAgentSessionPreSpawnError(error)) {
      return true
    }
    throw error
  }
  // Why: resolveCliCommand returns the bare name when nothing resolves, so only a path proves an install.
  return isAbsolute(command)
}

/** The PATH and home a launch resolves its CLI with, read from the environment it starts from. */
export function structuredLaunchResolutionOptions(env: Record<string, string>): CommandOptions {
  const homePath = env.HOME ?? env.USERPROFILE
  return { pathEnv: env.PATH ?? env.Path ?? null, ...(homePath ? { homePath } : {}) }
}
