import { translate } from '@/i18n/i18n'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { customRows } from './MarketplaceCatalogCustomRows'
import type { CatalogBuildInputs, CatalogRow } from './MarketplaceCatalogRows'
import {
  boardSkillRows,
  isBoardSkillName,
  normalizeSkillName,
  unansweredStatus
} from './MarketplaceCatalogPlaceholders'
import { builtInLabel, installedLabel, installLabel } from './MarketplaceCatalogStatusCopy'

type BuiltInCommand = {
  id: string
  name: string
  description: { key: string; fallback: string }
}

// Why: built into MassOrca, so each row shows Built-in, with no install action and no page.
const BUILT_IN_COMMANDS: readonly BuiltInCommand[] = [
  {
    id: 'prototype',
    name: '/prototype',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogSkillRows.prototypeDescription',
      fallback: 'Make HTML prototypes of an idea'
    }
  },
  {
    id: 'orchestration-delegate',
    name: 'orca orchestration delegate',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogSkillRows.orchestrationDelegateDescription',
      fallback: 'Ask which agent should run a child session of this chat'
    }
  }
]

/** A discovered skill the list shows: one added from the Marketplace, or a MassOrca board skill. */
function isListedSkill(skill: DiscoveredSkill): boolean {
  return skill.source === 'marketplace' || isBoardSkillName(skill.name)
}

/** Listed skills, then custom skills, then the board skills not on disk, then the built-in commands. */
export function skillRows(inputs: CatalogBuildInputs): CatalogRow[] {
  const { skills, hostLabel } = inputs
  const listed = skills.kind === 'ready' ? oneSkillPerName(skills.value.filter(isListedSkill)) : []
  const listedNames = new Set(listed.map((skill) => normalizeSkillName(skill.name)))
  const pending = skills.kind === 'ready' ? null : unansweredStatus(skills, hostLabel)
  return [
    ...listed.map(skillRow),
    ...customRows(inputs, 'skill', 'skills'),
    ...boardSkillRows(listedNames, pending),
    ...BUILT_IN_COMMANDS.map(commandRow)
  ]
}

// Why: one skill can sit in several agents' folders on a host; the list shows it once, installed if any copy is.
function oneSkillPerName(skills: readonly DiscoveredSkill[]): DiscoveredSkill[] {
  const byName = new Map<string, DiscoveredSkill>()
  for (const skill of skills) {
    const name = normalizeSkillName(skill.name)
    const kept = byName.get(name)
    if (kept === undefined || (!kept.installed && skill.installed)) {
      byName.set(name, skill)
    }
  }
  return [...byName.values()]
}

function skillRow(skill: DiscoveredSkill): CatalogRow {
  return {
    key: `skill-${skill.id}`,
    section: 'skills',
    name: skill.name,
    description: skill.description || skill.sourceLabel,
    icon: { kind: 'skill' },
    status: skill.installed
      ? { kind: 'done', label: installedLabel() }
      : { kind: 'action', label: installLabel() },
    target: { kind: 'skill', skill },
    owned: skill.installed,
    service: false,
    customId: null
  }
}

function commandRow(command: BuiltInCommand): CatalogRow {
  return {
    key: `command-${command.id}`,
    section: 'skills',
    name: command.name,
    description: translate(command.description.key, command.description.fallback),
    icon: { kind: 'skill' },
    status: { kind: 'done', label: builtInLabel() },
    target: null,
    // Why: built in rather than installed, so it stays out of Your apps and the sidebar.
    owned: false,
    service: false,
    customId: null
  }
}
