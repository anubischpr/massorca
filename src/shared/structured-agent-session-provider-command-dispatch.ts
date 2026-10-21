import {
  isAgentSessionProviderCommand,
  type AgentSessionProviderCommand
} from './agent-session-provider-command'
import type { StructuredAgentSessionCommandOutcome } from './structured-agent-session-composer'

type ProviderCommandRun = (
  command: AgentSessionProviderCommand,
  argument: string | undefined
) => Promise<Omit<StructuredAgentSessionCommandOutcome, 'handled'>>

export type StructuredAgentSessionProviderCommandSurface = {
  /** The commands the host reported this session can run now. */
  providerCommands?: readonly AgentSessionProviderCommand[]
  runProviderCommand?: ProviderCommandRun
  /** `/ps` and `/tasks`: shows the background tasks the chat lists; false when it has none to show. */
  revealBackgroundTasks?: () => boolean
  /** `/diff`: opens the workspace's source-control view; false when it cannot open. */
  openSourceControl?: () => Promise<boolean>
}

/** What a command takes after its name: nothing, one required text, one optional text, or a choice. */
const ARGUMENT_RULES: Record<
  AgentSessionProviderCommand,
  { kind: 'none' } | { kind: 'text'; required: boolean; hint: string } | { kind: 'toggle' }
> = {
  usage: { kind: 'none' },
  skills: { kind: 'none' },
  plugins: { kind: 'none' },
  fork: { kind: 'none' },
  approve: { kind: 'none' },
  stop: { kind: 'none' },
  memories: { kind: 'toggle' },
  rename: { kind: 'text', required: true, hint: 'a name' },
  name: { kind: 'text', required: true, hint: 'a name' },
  review: { kind: 'text', required: false, hint: 'instructions' },
  export: { kind: 'text', required: false, hint: 'a file path' }
}

/** The argument a command sends, or the sentence that says what it takes instead. */
function providerCommandArgument(
  command: AgentSessionProviderCommand,
  argument: string
): { ok: true; argument: string | undefined } | { ok: false; error: string } {
  const rule = ARGUMENT_RULES[command]
  switch (rule.kind) {
    case 'none':
      return argument === ''
        ? { ok: true, argument: undefined }
        : { ok: false, error: `Use /${command} without arguments.` }
    case 'toggle': {
      const choice = argument.toLowerCase()
      return choice === '' || choice === 'on' || choice === 'off'
        ? { ok: true, argument: choice === '' ? undefined : choice }
        : { ok: false, error: `Use /${command} on or /${command} off.` }
    }
    case 'text':
      return argument === '' && rule.required
        ? { ok: false, error: `Give ${rule.hint} after /${command}.` }
        : { ok: true, argument: argument === '' ? undefined : argument }
  }
}

/** Answers `/name` when it is a provider command this session runs, or one the host answers with a
 *  surface it has (`/ps`, `/tasks`, `/diff`); null leaves it to the next handler. */
export async function dispatchStructuredAgentSessionProviderCommand(
  command: { name: string; argument: string },
  surface: StructuredAgentSessionProviderCommandSurface
): Promise<StructuredAgentSessionCommandOutcome | null> {
  if (command.name === 'diff' && surface.openSourceControl) {
    if (command.argument !== '') {
      return { handled: true, accepted: false, error: 'Use /diff without arguments.' }
    }
    const opened = await surface.openSourceControl()
    return {
      handled: true,
      accepted: opened,
      error: opened ? null : 'Could not open source control.'
    }
  }
  if ((command.name === 'ps' || command.name === 'tasks') && surface.revealBackgroundTasks) {
    if (command.argument !== '') {
      return { handled: true, accepted: false, error: `Use /${command.name} without arguments.` }
    }
    const shown = surface.revealBackgroundTasks()
    return {
      handled: true,
      accepted: shown,
      error: shown ? null : 'No background tasks are running.'
    }
  }
  const name = command.name
  if (
    !isAgentSessionProviderCommand(name) ||
    !surface.providerCommands?.includes(name) ||
    !surface.runProviderCommand
  ) {
    return null
  }
  const parsed = providerCommandArgument(name, command.argument)
  if (!parsed.ok) {
    return { handled: true, accepted: false, error: parsed.error }
  }
  return { handled: true, ...(await surface.runProviderCommand(name, parsed.argument)) }
}
