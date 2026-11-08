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
import {
  BUILT_IN_SKILL_COMMAND_ORDER,
  BUILT_IN_SKILL_COMMANDS,
  type BuiltInSkillCommand
} from './marketplace-skill-built-in'
import { skillDisplayName } from './marketplace-skill-display-name'

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
    ...customSkillRows(inputs),
    ...boardSkillRows(listedNames, pending),
    ...BUILT_IN_SKILL_COMMAND_ORDER.map((id) => commandRow(BUILT_IN_SKILL_COMMANDS[id]))
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
    name: skillDisplayName(skill.name),
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

/** Custom skills open their own page; the custom list still decides their install state. */
function customSkillRows(inputs: CatalogBuildInputs): CatalogRow[] {
  return customRows(inputs, 'skill', 'skills').map((row): CatalogRow => ({
    ...row,
    name: skillDisplayName(row.name)
  }))
}

function commandRow(command: BuiltInSkillCommand): CatalogRow {
  return {
    key: `command-${command.id}`,
    section: 'skills',
    name: skillDisplayName(command.name),
    description: translate(command.description.key, command.description.fallback),
    icon: { kind: 'skill' },
    status: { kind: 'done', label: builtInLabel() },
    target: { kind: 'built-in', id: command.id },
    // Why: built in rather than installed, so it stays out of Your apps and the sidebar.
    owned: false,
    service: false,
    customId: null
  }
}
