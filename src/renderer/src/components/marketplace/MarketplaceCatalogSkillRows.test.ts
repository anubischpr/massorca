import { describe, expect, it, vi } from 'vitest'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { MarketplaceIntegrationStates } from './marketplace-integrations'
import {
  buildCatalogSections,
  ownedRows,
  type CatalogBuildInputs,
  type CatalogRow
} from './MarketplaceCatalogRows'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => agent,
  getAgentDisplayLabel: (agent: string) => agent
}))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))

const BOARD_SKILLS = ['Browser use', 'Computer use', 'Linear', 'Orchestration', 'Price check']
const COMMANDS = ['/prototype', 'orca orchestration delegate']
const BUILT_IN_STATUS = { kind: 'done', label: 'Built-in' } as const

function integrationStates(): MarketplaceIntegrationStates {
  return {
    gitlab: 'not-connected',
    bitbucket: 'not-connected',
    'azure-devops': 'not-connected',
    gitea: 'not-connected',
    linear: 'not-connected',
    jira: 'not-connected'
  }
}

function inputs(overrides: Partial<CatalogBuildInputs> = {}): CatalogBuildInputs {
  return {
    hostLabel: 'This computer',
    badgeFor: () => 'not-installed',
    cli: { gh: 'not-installed' },
    integrations: integrationStates(),
    agents: [],
    skills: { kind: 'ready', value: [] },
    custom: { kind: 'ready', items: [] },
    installingCustomIds: new Set(),
    ...overrides
  }
}

function skill(name: string, overrides: Partial<DiscoveredSkill> = {}): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/home/dev/.agents/skills',
    directoryPath: `/home/dev/.agents/skills/${name}`,
    skillFilePath: `/home/dev/.agents/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

/** A skill an agent ships in its own root, such as Codex's `.system` folder. */
function bundledSkill(name: string): DiscoveredSkill {
  return skill(name, {
    sourceKind: 'bundled',
    sourceLabel: 'Codex system skills',
    rootPath: '/home/dev/.codex/skills/.system',
    directoryPath: `/home/dev/.codex/skills/.system/${name}`
  })
}

/** A skill an agent plugin brings with it. */
function pluginSkill(name: string): DiscoveredSkill {
  return skill(name, {
    sourceKind: 'plugin',
    sourceLabel: 'Expo plugin',
    rootPath: '/home/dev/.claude/plugins/expo/skills',
    directoryPath: `/home/dev/.claude/plugins/expo/skills/${name}`
  })
}

function addedFromMarketplace(name: string): DiscoveredSkill {
  return skill(name, { source: 'marketplace' })
}

function customSkill(id: string, name: string): MarketplaceCustomItemStatus {
  return {
    id,
    kind: 'skill',
    name,
    checkCommand: null,
    install: {},
    skillUrl: `https://example.com/skills/${id}`,
    createdAt: 1,
    presence: 'found'
  }
}

function skillRowsOf(overrides: Partial<CatalogBuildInputs>): CatalogRow[] {
  const section = buildCatalogSections(inputs(overrides)).find(
    (candidate) => candidate.id === 'skills'
  )
  if (!section) {
    throw new Error('No Skills section')
  }
  return section.rows
}

function namesOf(rows: readonly CatalogRow[]): string[] {
  return rows.map((row) => row.name)
}

describe('the Skills section lists only what the person added or MassOrca ships', () => {
  it('hides the skills an agent or its installer ships: bundled, plugin and plain home skills', () => {
    const rows = skillRowsOf({
      skills: {
        kind: 'ready',
        value: [bundledSkill('imagegen'), pluginSkill('expo:expo-router'), skill('sdd-init')]
      }
    })
    expect(namesOf(rows)).toEqual([...BOARD_SKILLS, ...COMMANDS])
  })

  it('lists a skill added from the Marketplace and a custom skill, with the board and command rows', () => {
    const rows = skillRowsOf({
      skills: { kind: 'ready', value: [addedFromMarketplace('calendar'), skill('sdd-init')] },
      custom: { kind: 'ready', items: [customSkill('team', 'Team skill')] }
    })
    expect(namesOf(rows)).toEqual(['calendar', 'Team skill', ...BOARD_SKILLS, ...COMMANDS])
    expect(rows.find((row) => row.name === 'calendar')).toMatchObject({
      status: { kind: 'done', label: 'Installed' },
      owned: true,
      target: { kind: 'skill' }
    })
    expect(rows.find((row) => row.name === 'Team skill')).toMatchObject({
      status: { kind: 'done', label: 'Installed' },
      owned: true,
      customId: 'team',
      target: null
    })
  })

  it('shows a board skill the disk has as its discovered row, and the other board skills as Install', () => {
    const rows = skillRowsOf({ skills: { kind: 'ready', value: [skill('browser-use')] } })
    expect(namesOf(rows)).toEqual([
      'browser-use',
      'Computer use',
      'Linear',
      'Orchestration',
      'Price check',
      ...COMMANDS
    ])
    expect(rows[0]).toMatchObject({
      status: { kind: 'done', label: 'Installed' },
      target: { kind: 'skill' }
    })
    expect(rows.find((row) => row.name === 'Linear')).toMatchObject({
      status: { kind: 'action', label: 'Install' },
      target: null
    })
  })

  it('lists a skill that sits in two agent folders once, as installed', () => {
    const claudeCopy = skill('computer-use', {
      id: 'skill-claude-computer-use',
      sourceLabel: 'Claude home',
      rootPath: '/home/dev/.claude/skills',
      directoryPath: '/home/dev/.claude/skills/computer-use',
      skillFilePath: '/home/dev/.claude/skills/computer-use/SKILL.md',
      installed: false
    })
    const rows = skillRowsOf({
      skills: { kind: 'ready', value: [claudeCopy, skill('computer-use')] }
    })
    expect(namesOf(rows).filter((name) => name === 'computer-use')).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'computer-use',
      status: { kind: 'done', label: 'Installed' }
    })
    expect(namesOf(rows)).not.toContain('Computer use')
  })

  it('shows the built-in commands as Built-in, with no install action and no page of their own', () => {
    const rows = skillRowsOf({})
    for (const name of COMMANDS) {
      expect(rows.find((row) => row.name === name)).toMatchObject({
        section: 'skills',
        status: BUILT_IN_STATUS,
        target: null,
        customId: null
      })
    }
    expect(rows.find((row) => row.name === '/prototype')?.description).toBe(
      'Make HTML prototypes of an idea'
    )
    expect(rows.find((row) => row.name === 'orca orchestration delegate')?.description).toBe(
      'Ask which agent should run a child session of this chat'
    )
  })

  it('keeps the commands listed while the host skills are still being checked', () => {
    const rows = skillRowsOf({ skills: { kind: 'loading' } })
    expect(namesOf(rows).slice(-COMMANDS.length)).toEqual(COMMANDS)
  })

  it('keeps Your apps to the same skills the Skills section lists as installed', () => {
    const owned = ownedRows(
      buildCatalogSections(
        inputs({
          skills: {
            kind: 'ready',
            value: [
              addedFromMarketplace('calendar'),
              skill('sdd-init'),
              bundledSkill('imagegen'),
              pluginSkill('expo:expo-router')
            ]
          },
          custom: { kind: 'ready', items: [customSkill('team', 'Team skill')] }
        })
      )
    )
    expect(namesOf(owned)).toEqual(['calendar', 'Team skill'])
  })
})
