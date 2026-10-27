import type { TuiAgent } from './tui-agent'

/**
 * Naming for a workspace created from the create-chat view. The session's own agent names the
 * work; `model` is the model picked in create-chat (null = the agent's default pick).
 */
export type CreateChatNamingOverride = { model: string | null }

export type CreateChatNamingModel =
  | { kind: 'model'; modelId: string }
  /** Run the CLI without a model flag so its own default applies. */
  | { kind: 'inherit' }
  /** Nothing usable for this agent: keep the global Source Control AI params. */
  | { kind: 'global' }

export type DiscoveredNamingModel = { id: string; label?: string }

export type CreateChatNamingModelInput = {
  agentId: TuiAgent
  /** From the installed CLI's model discovery; empty when discovery failed. */
  discoveredModels: readonly DiscoveredNamingModel[]
  pickedModel: string | null
  specDefaultModelId: string | undefined
}

/** Agents whose naming model is chosen from discovery, so the hook runs discovery for them. */
export const CREATE_CHAT_NAMING_DISCOVERY_AGENTS: ReadonlySet<TuiAgent> = new Set<TuiAgent>([
  'claude',
  'codex',
  'antigravity'
])

const NAMING_FAMILY_BY_AGENT: Partial<Record<TuiAgent, RegExp>> = {
  claude: /sonnet/i,
  codex: /terra/i,
  antigravity: /flash/i
}

/** Every number in the text, in order: `gpt-5.6-terra` -> [5, 6], `claude-sonnet-5-5` -> [5, 5]. */
export function parseModelVersion(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number)
}

/** Numeric, component by component, so 5.10 beats 5.9 and 6.1 beats 5.6. */
export function compareModelVersions(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

function newestModelIdInFamily(
  models: readonly DiscoveredNamingModel[],
  family: RegExp
): string | null {
  let best: { id: string; version: number[] } | null = null
  for (const model of models) {
    // Why: `default` on Antigravity resolves to whatever the account's config picks (Argon), never a Flash.
    if (model.id === 'default') {
      continue
    }
    const labelMatches = model.label !== undefined && family.test(model.label)
    if (!family.test(model.id) && !labelMatches) {
      continue
    }
    const idVersion = parseModelVersion(model.id)
    const version = idVersion.length > 0 ? idVersion : parseModelVersion(model.label ?? '')
    if (!best || compareModelVersions(version, best.version) > 0) {
      best = { id: model.id, version }
    }
  }
  return best?.id ?? null
}

/** Picks the model that names a create-chat workspace; never reads the global Source Control AI setting. */
export function selectCreateChatNamingModel(
  input: CreateChatNamingModelInput
): CreateChatNamingModel {
  const { agentId, discoveredModels, pickedModel, specDefaultModelId } = input
  if (agentId === 'pi') {
    // Why: Gentle Shell names with the model the user chose beside it, or its own default.
    return pickedModel ? { kind: 'model', modelId: pickedModel } : { kind: 'inherit' }
  }
  const family = NAMING_FAMILY_BY_AGENT[agentId]
  if (!family) {
    return { kind: 'global' }
  }
  const newest = newestModelIdInFamily(discoveredModels, family)
  if (newest) {
    return { kind: 'model', modelId: newest }
  }
  if (agentId === 'claude') {
    return { kind: 'inherit' }
  }
  if (agentId === 'codex' && specDefaultModelId) {
    return { kind: 'model', modelId: specDefaultModelId }
  }
  return { kind: 'global' }
}

/** Reads a persisted or IPC-supplied override; anything malformed is treated as absent. */
export function normalizeCreateChatNaming(raw: unknown): CreateChatNamingOverride | undefined {
  if (!raw || typeof raw !== 'object' || !('model' in raw)) {
    return undefined
  }
  const model = raw.model
  return { model: typeof model === 'string' && model.trim() !== '' ? model : null }
}
