import { findCatalogOption } from './agent-session-option-catalog'
import { getAgentSessionOptionLaunchCatalog } from './agent-session-option-launch'
import type { BotTeamBot } from './rpc-contract/bot-team-params'

export type BotModelOption = {
  id: string
  label: string
  efforts: readonly { value: string; label: string }[]
}

/** The models a person can pin on a bot, from the catalog a session start validates against. */
export function botModelOptions(agent: BotTeamBot['agent']): BotModelOption[] {
  const catalog = getAgentSessionOptionLaunchCatalog(agent)
  if (!catalog?.supportsWorkerLaunchPreferences) {
    return []
  }
  return catalog.models.map((model) => {
    const effort = findCatalogOption(model, 'effort')
    return {
      id: model.id,
      label: model.label,
      efforts:
        effort?.kind.type === 'select'
          ? effort.kind.choices.map(({ value, label }) => ({ value, label }))
          : []
    }
  })
}

/** How a chosen model and effort read to a person: "Sonnet, high". */
export function botModelSummary(
  bot: Pick<BotTeamBot, 'agent' | 'model' | 'effort'>
): string | null {
  if (bot.model === null) {
    return null
  }
  const model = botModelOptions(bot.agent).find((entry) => entry.id === bot.model)
  const effort = model?.efforts.find((entry) => entry.value === bot.effort)?.label ?? bot.effort
  return [model?.label ?? bot.model, effort].filter(Boolean).join(', ')
}
