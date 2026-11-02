// What a delegated prototype task's card preselects and answers: the count and the design system choice.
import type { DelegationPrototypeCount } from './delegated-session-journal'
import type { PrototypeDesignSystemMode } from './prototype-design-system-files'
import type { PrototypeSystemCard } from './prototype-design-system-card'

/**
 * The count a card highlights before the person picks: the viewer's own Settings count when the card
 * offers it, else the host's. A paired client edits its own Settings, so the host's value may differ.
 */
export function delegationCountDefault(
  count: DelegationPrototypeCount,
  viewerSettingCount?: number
): number {
  return viewerSettingCount !== undefined && count.choices.includes(viewerSettingCount)
    ? viewerSettingCount
    : count.defaultCount
}

/**
 * The design system choices a card offers, in the direct request card's order: an existing system is used
 * (Review first opens it and answers nothing); a project without one is proposed one or skips it.
 */
export function delegationDesignSystemModes(
  card: PrototypeSystemCard
): readonly PrototypeDesignSystemMode[] {
  return card.kind === 'existing' ? ['use'] : ['propose', 'skip']
}

/** The choice highlighted before the person picks: the first one the card offers. */
export function defaultDelegationDesignSystemMode(
  card: PrototypeSystemCard
): PrototypeDesignSystemMode {
  return delegationDesignSystemModes(card)[0] ?? 'use'
}
