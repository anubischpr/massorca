import type {
  AgentSessionOptionCatalog,
  CatalogModel,
  CatalogOption
} from './agent-session-option-catalog'
import type { AgentSessionOptionsResult } from './agent-session-wire'

function effortOption(model: AgentSessionOptionsResult['models'][number]): CatalogOption | null {
  if (model.efforts.length <= 1) {
    return null
  }
  return {
    id: 'effort',
    label: 'Reasoning effort',
    category: 'thought_level',
    kind: {
      type: 'select',
      choices: model.efforts,
      defaultValue: model.defaultEffort ?? model.efforts[0]!.value,
      ...(model.defaultEffort ? { defaultIsCliDefault: true as const } : {})
    },
    apply: { midSession: { kind: 'command', build: (value) => `/effort ${String(value)}` } }
  }
}

function fastModeOption(): CatalogOption {
  return {
    id: 'fastMode',
    label: 'Fast mode',
    category: 'mode',
    kind: { type: 'boolean', defaultValue: false },
    apply: {}
  }
}

export function discoveredModel(
  model: AgentSessionOptionsResult['models'][number],
  sessionSupportsFastMode: boolean
): CatalogModel {
  const effort = effortOption(model)
  return {
    id: model.id,
    label: model.label,
    ...(model.description ? { description: model.description } : {}),
    ...(model.isDefault ? { isDefault: true } : {}),
    options: [
      ...(effort ? [effort] : []),
      ...(sessionSupportsFastMode && model.supportsFastMode === true ? [fastModeOption()] : [])
    ]
  }
}

export function structuredAgentSessionOptionCatalog(
  seed: AgentSessionOptionCatalog,
  result: AgentSessionOptionsResult
): AgentSessionOptionCatalog {
  const models: CatalogModel[] = result.models.map((model) =>
    discoveredModel(model, result.fastModeSupport?.supported === true)
  )
  if (result.current.model && !models.some((model) => model.id === result.current.model)) {
    models.push({
      id: result.current.model,
      label: result.current.model,
      options: seed.unknownModelOptions ?? []
    })
  }
  return { ...seed, models, defaultModelIsCliDefault: true }
}
