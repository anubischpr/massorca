/** The skill commands MassOrca builds in: their rows show Built-in, and their page says what they are. */
export type BuiltInSkillCommandId = 'prototype' | 'orchestration-delegate'

export type BuiltInSkillCommand = {
  id: BuiltInSkillCommandId
  /** The command as it is typed; the row and page show its display name. */
  name: string
  description: { key: string; fallback: string }
  /** The Settings pane that configures the command, or null when it has no setting of its own. */
  settingsPane: 'orchestration' | null
}

export const BUILT_IN_SKILL_COMMANDS: Record<BuiltInSkillCommandId, BuiltInSkillCommand> = {
  prototype: {
    id: 'prototype',
    name: '/prototype',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogSkillRows.prototypeDescription',
      fallback: 'Make HTML prototypes of an idea'
    },
    settingsPane: null
  },
  'orchestration-delegate': {
    id: 'orchestration-delegate',
    name: 'orca orchestration delegate',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogSkillRows.orchestrationDelegateDescription',
      fallback: 'Ask which agent should run a child session of this chat'
    },
    settingsPane: 'orchestration'
  }
}

/** The order the Skills section lists the built-in commands in. */
export const BUILT_IN_SKILL_COMMAND_ORDER: readonly BuiltInSkillCommandId[] = [
  'prototype',
  'orchestration-delegate'
]
