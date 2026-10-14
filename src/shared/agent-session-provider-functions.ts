import type { AgentSessionSlashCommand } from './agent-session-wire'

type CommonOperation = 'model' | 'effort' | 'clear' | 'compact' | 'goal'
type ProviderSource = 'provider-session' | 'provider-initialization' | 'provider-files'
type FunctionDescription = Pick<AgentSessionSlashCommand, 'name' | 'description' | 'argumentHint'>

export type AgentSessionProviderFunction = FunctionDescription &
  (
    | {
        provenance: 'orca'
        availability: 'available'
        execution: { kind: 'host-operation'; operation: CommonOperation }
      }
    | {
        provenance: ProviderSource
        availability: 'available' | 'unverified'
        execution: { kind: 'provider-prompt' }
      }
    | {
        provenance: ProviderSource
        availability: 'terminal-only'
        execution: { kind: 'terminal' }
      }
  )

const COMMON_OPERATIONS = new Map<string, CommonOperation>([
  ['model', 'model'],
  ['effort', 'effort'],
  ['clear', 'clear'],
  ['compact', 'compact'],
  ['goal', 'goal']
])

/** Classifies existing discovery; common entries must come from the host's supported handlers. */
export function classifyAgentSessionFunctions(input: {
  commands: readonly AgentSessionSlashCommand[] | undefined
  source: ProviderSource
  commonCommands?: readonly AgentSessionSlashCommand[]
  terminalCommands?: readonly FunctionDescription[]
}): AgentSessionProviderFunction[] | undefined {
  if (input.commands === undefined) {
    return undefined
  }
  const functions = new Map<string, AgentSessionProviderFunction>()
  for (const command of input.commonCommands ?? []) {
    const operation = COMMON_OPERATIONS.get(command.name)
    if (command.kind !== 'command' || !operation) {
      continue
    }
    functions.set(command.name, {
      ...descriptionOf(command),
      provenance: 'orca',
      availability: 'available',
      execution: { kind: 'host-operation', operation }
    })
  }
  const terminalNames = new Set(input.terminalCommands?.map((entry) => entry.name))
  for (const command of input.commands) {
    if (
      command.kind !== 'command' ||
      functions.has(command.name) ||
      terminalNames.has(command.name)
    ) {
      continue
    }
    functions.set(command.name, {
      ...descriptionOf(command),
      provenance: input.source,
      availability:
        input.source === 'provider-session' && !command.kindUnspecified
          ? 'available'
          : 'unverified',
      execution: { kind: 'provider-prompt' }
    })
  }
  for (const command of input.terminalCommands ?? []) {
    if (functions.has(command.name)) {
      continue
    }
    functions.set(command.name, {
      ...descriptionOf(command),
      provenance: input.source,
      availability: 'terminal-only',
      execution: { kind: 'terminal' }
    })
  }
  return [...functions.values()]
}

function descriptionOf(command: FunctionDescription): FunctionDescription {
  return {
    name: command.name,
    ...(command.description ? { description: command.description } : {}),
    ...(command.argumentHint ? { argumentHint: command.argumentHint } : {})
  }
}
