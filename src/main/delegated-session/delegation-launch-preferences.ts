import { findCatalogModel, findCatalogOption } from '../../shared/agent-session-option-catalog'
import { getAgentSessionOptionLaunchCatalog } from '../../shared/agent-session-option-launch'
import type { DelegationTier } from '../../shared/delegated-session-types'
import { isTuiAgent } from '../../shared/tui-agent-config'
import { resolveDelegationModel, type DelegationModelCatalog } from './delegation-model-tiers'

/** The effort levels worker-start accepts for `model`, from the same catalog it validates against. */
function launchEfforts(agent: string, model: string): readonly string[] | undefined {
  const catalog = isTuiAgent(agent) ? getAgentSessionOptionLaunchCatalog(agent) : null
  if (!catalog?.supportsWorkerLaunchPreferences) {
    return undefined
  }
  const known = findCatalogModel(catalog, model)
  const option =
    findCatalogOption(known, 'effort') ??
    (known ? undefined : catalog.unknownModelOptions?.find((entry) => entry.id === 'effort'))
  return option?.kind.type === 'select' ? option.kind.choices.map((choice) => choice.value) : []
}

/**
 * The model catalog the router clamps against for one agent at one tier: the tier's own model is
 * taken as available (the static catalogs are seeds, not complete lists), and its efforts are the
 * ones worker-start would accept, so a start never fails on a level the model lacks.
 */
export function delegationLaunchCatalog(
  agent: string,
  tier: DelegationTier
): DelegationModelCatalog | undefined {
  const { model } = resolveDelegationModel({ agent, tier })
  if (model === null) {
    return undefined
  }
  const efforts = launchEfforts(agent, model)
  return { models: [model], ...(efforts ? { efforts } : {}) }
}

/**
 * Model and effort as worker-start can apply them. Worker-start refuses an effort without a model,
 * so an agent that runs its own default model runs its own default effort too.
 */
export function resolveLaunchableDelegationModel(input: { agent: string; tier: DelegationTier }): {
  model: string | null
  effort: string | null
} {
  const { model, effort } = resolveDelegationModel({
    agent: input.agent,
    tier: input.tier,
    catalog: delegationLaunchCatalog(input.agent, input.tier)
  })
  return { model, effort: model === null ? null : effort }
}
