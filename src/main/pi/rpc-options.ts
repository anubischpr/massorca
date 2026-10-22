import { z } from 'zod'
import type {
  AgentSessionCommandsResult,
  AgentSessionOptionsResult
} from '../../shared/agent-session-wire'
import { piRpcModelSchema, piRpcStateSchema } from './rpc-protocol'

export type PiRpcRequester = {
  request(
    command: string,
    params?: Record<string, unknown>,
    options?: { timeoutMs?: number | null }
  ): Promise<unknown>
}

const modelSchema = piRpcModelSchema.safeExtend({
  provider: z.string().min(1),
  id: z.string().min(1),
  thinkingLevelMap: z.record(z.string(), z.string().nullable()).optional()
})
const modelsSchema = z.object({ models: z.array(modelSchema) })
const stateSchema = piRpcStateSchema.safeExtend({
  model: modelSchema.nullish()
})
const commandsSchema = z.object({
  commands: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      source: z.string().optional()
    })
  )
})

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
/** The levels a reasoning model offers unless its thinking map removes one; the rest need a map entry. */
export const PI_UNMAPPED_THINKING_LEVELS = THINKING_LEVELS.filter(
  (level) => level !== 'xhigh' && level !== 'max'
)

export function piModelOptionId(provider: string, modelId: string): string {
  if (!provider || !modelId || provider.includes('/')) {
    throw new Error('Pi model requires an explicit provider and model ID')
  }
  return `${provider}/${modelId}`
}

export function parsePiModelOptionId(value: string): { provider: string; modelId: string } {
  const slash = value.indexOf('/')
  if (slash < 1 || slash === value.length - 1) {
    throw new Error('Pi model requires an explicit provider and model ID')
  }
  return { provider: value.slice(0, slash), modelId: value.slice(slash + 1) }
}

export async function readPiRpcSessionOptions(
  rpc: PiRpcRequester
): Promise<AgentSessionOptionsResult> {
  const models = modelsSchema.parse(await rpc.request('get_available_models')).models
  const state = stateSchema.parse(await rpc.request('get_state'))
  const currentModel = state.model
  const currentId = currentModel ? piModelOptionId(currentModel.provider, currentModel.id) : ''
  const listed = models.map((model) => {
    const id = piModelOptionId(model.provider, model.id)
    const efforts =
      model.reasoning !== true
        ? []
        : THINKING_LEVELS.filter((level) => {
            const mapped = model.thinkingLevelMap?.[level]
            return (
              mapped !== null && ((level !== 'xhigh' && level !== 'max') || mapped !== undefined)
            )
          }).map((level) => ({ value: level, label: level }))
    return {
      id,
      label: model.name || id,
      isDefault: false,
      efforts
    }
  })
  return {
    models: listed,
    current: {
      model: currentId,
      ...(state.thinkingLevel ? { effort: state.thinkingLevel } : {}),
      confirmed: [...(currentId ? ['model'] : []), ...(state.thinkingLevel ? ['effort'] : [])]
    }
  }
}

export async function applyPiRpcSessionOption(
  rpc: PiRpcRequester,
  selected: Map<string, string>,
  key: string,
  value: string
): Promise<Readonly<Record<string, string>>> {
  if (key === 'model') {
    const model = parsePiModelOptionId(value)
    modelSchema.parse({ provider: model.provider, id: model.modelId })
    await rpc.request('set_model', model)
  } else if (key === 'effort') {
    if (!THINKING_LEVELS.some((level) => level === value)) {
      throw new Error(`Unsupported Pi thinking level: ${value}`)
    }
    await rpc.request('set_thinking_level', { level: value })
  } else {
    throw new Error(`Unsupported Pi option: ${key}`)
  }
  selected.set(key, value)
  return Object.fromEntries(selected)
}

/** Re-applies a saved chat's model and effort; returns the saved keys the child did not take. */
export async function restorePiRpcSessionOptions(
  rpc: PiRpcRequester,
  selected: Map<string, string>,
  saved: Readonly<Record<string, string>>,
  rejected: (key: string, error: unknown) => void
): Promise<string[]> {
  const skipped: string[] = []
  for (const [key, value] of Object.entries(saved)) {
    // Orca's own launch selections: the child never takes them as options, and a record that
    // dropped them would restart the chat as another runtime or access.
    if (key === 'accessMode' || key === 'piRuntime') {
      continue
    }
    if (key !== 'model' && key !== 'effort') {
      skipped.push(key)
      continue
    }
    try {
      await applyPiRpcSessionOption(rpc, selected, key, value)
    } catch (error) {
      skipped.push(key)
      rejected(key, error)
    }
  }
  return skipped
}

export async function readPiRpcCommands(rpc: PiRpcRequester): Promise<AgentSessionCommandsResult> {
  const { commands } = commandsSchema.parse(await rpc.request('get_commands'))
  return {
    commands: commands.map((command) => ({
      name: command.name,
      kind: command.source === 'skill' ? 'skill' : 'command',
      ...(command.source === undefined ? { kindUnspecified: true as const } : {}),
      ...(command.description ? { description: command.description } : {})
    }))
  }
}
