import { describe, expect, it, vi } from 'vitest'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import {
  buildCatalogSections,
  ownedRows,
  rowMatchesQuery,
  type CatalogBuildInputs,
  type CatalogRow,
  type CatalogSection
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

function badges(
  states: Partial<Record<MarketplaceItemId, MarketplaceBadgeState>>
): CatalogBuildInputs['badgeFor'] {
  return (id) => states[id] ?? 'not-installed'
}

function inputs(overrides: Partial<CatalogBuildInputs> = {}): CatalogBuildInputs {
  return {
    hostLabel: 'This computer',
    badgeFor: badges({}),
    agentEntries: [
      { id: 'claude', label: 'Claude Code' },
      { id: 'codex', label: 'Codex' }
    ],
    detectedAgents: { kind: 'ready', items: ['codex'] },
    skills: { kind: 'ready', items: [] },
    custom: { kind: 'ready', items: [] },
    installingCustomIds: new Set(),
    cli: { gh: 'not-installed', gitlab: 'not-installed' },
    ...overrides
  }
}

function sectionNamed(sections: readonly CatalogSection[], name: string): CatalogSection {
  const section = sections.find((candidate) => candidate.name === name)
  if (!section) {
    throw new Error(`No section ${name}`)
  }
  return section
}

function rowNamed(sections: readonly CatalogSection[], name: string): CatalogRow {
  const row = sections
    .flatMap((section) => section.rows)
    .find((candidate) => candidate.name === name)
  if (!row) {
    throw new Error(`No row ${name}`)
  }
  return row
}

function skill(name: string, installed = true): DiscoveredSkill {
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
    installed,
    updatedAt: null
  }
}

function custom(
  overrides: Partial<MarketplaceCustomItemStatus> & Pick<MarketplaceCustomItemStatus, 'id' | 'name'>
): MarketplaceCustomItemStatus {
  return {
    kind: 'tool',
    checkCommand: ['mytool', '--version'],
    install: {},
    createdAt: 1,
    presence: 'found',
    ...overrides
  }
}

describe('the catalog sections', () => {
  it('lists Tools, Agents, Skills and Services in that order with the board notes', () => {
    const sections = buildCatalogSections(inputs())
    expect(sections.map((section) => section.name)).toEqual([
      'Tools',
      'Agents',
      'Skills',
      'Services'
    ])
    expect(sections.map((section) => section.note)).toEqual([
      'On This computer',
      'On This computer. Each host has its own.',
      'For the agents on This computer',
      'Accounts are kept on each host'
    ])
  })

  it('puts Git, GitHub CLI, Node.js and Engram under Tools, in the board order', () => {
    const sections = buildCatalogSections(inputs())
    expect(sectionNamed(sections, 'Tools').rows.map((row) => row.name)).toEqual([
      'Git',
      'GitHub CLI',
      'Node.js',
      'Engram'
    ])
  })

  it('puts OpenMetadata, GitHub, GitLab, Email, Calendar, Shared drive and [CRM] under Services, in the board order', () => {
    const sections = buildCatalogSections(inputs())
    expect(sectionNamed(sections, 'Services').rows.map((row) => row.name)).toEqual([
      'OpenMetadata',
      'GitHub',
      'GitLab',
      'Email',
      'Calendar',
      'Shared drive',
      '[CRM]'
    ])
  })
})

describe('the board-only rows, the CLI rows and skill rows', () => {
  it('shows Node.js and the bot-team services with a disabled action and no status', () => {
    const sections = buildCatalogSections(inputs())
    const expected: [string, string, string][] = [
      ['Node.js', 'Install', 'Runs the JavaScript tools some agents call.'],
      ['Email', 'Connect', 'Bot teams read and send mail.'],
      ['Calendar', 'Connect', 'Bot teams read and add events.'],
      ['Shared drive', 'Connect', 'Bot teams read and save shared files.'],
      ['[CRM]', 'Connect', 'Bot teams read customers and deals.']
    ]
    for (const [name, label, description] of expected) {
      const row = rowNamed(sections, name)
      expect(row.status).toEqual({ kind: 'action', label })
      expect(row.description).toBe(description)
      expect(row.owned).toBe(false)
      expect(row.target).toBeNull()
      expect(row.customId).toBeNull()
    }
  })

  it('keeps the board-only rows out of Your apps, while the real rows that are owned stay in', () => {
    const owned = ownedRows(
      buildCatalogSections(
        inputs({
          badgeFor: badges({
            git: 'installed',
            engram: 'connected',
            github: 'signed-in',
            openmetadata: 'connected'
          }),
          cli: { gh: 'installed', gitlab: 'signed-in' }
        })
      )
    )
    expect(owned.map((row) => row.name)).toEqual([
      'Git',
      'GitHub CLI',
      'Engram',
      'Codex',
      'OpenMetadata',
      'GitHub',
      'GitLab'
    ])
  })

  it('shows GitHub CLI from the computer check, and Could not check while that check is unknown', () => {
    const installed = rowNamed(
      buildCatalogSections(inputs({ cli: { gh: 'installed', gitlab: 'not-installed' } })),
      'GitHub CLI'
    )
    expect(installed.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(installed.owned).toBe(true)
    expect(installed.target).toBeNull()
    expect(rowNamed(buildCatalogSections(inputs()), 'GitHub CLI').status).toEqual({
      kind: 'action',
      label: 'Install'
    })
    const unknown = rowNamed(
      buildCatalogSections(inputs({ cli: { gh: 'unknown', gitlab: 'unknown' } })),
      'GitHub CLI'
    )
    expect(unknown.status).toEqual({ kind: 'pending', label: 'Could not check' })
  })

  it('shows GitLab as Connected and owned only when glab is signed in, and Connect otherwise', () => {
    const signedIn = rowNamed(
      buildCatalogSections(inputs({ cli: { gh: 'not-installed', gitlab: 'signed-in' } })),
      'GitLab'
    )
    expect(signedIn.status).toEqual({ kind: 'done', label: 'Connected' })
    expect(signedIn.owned).toBe(true)
    expect(signedIn.service).toBe(true)
    const notSigned = rowNamed(
      buildCatalogSections(inputs({ cli: { gh: 'not-installed', gitlab: 'not-signed-in' } })),
      'GitLab'
    )
    expect(notSigned.status).toEqual({ kind: 'action', label: 'Connect' })
    expect(notSigned.owned).toBe(false)
  })

  it('opens a skill row with the skill it lists', () => {
    const listed = skill('alpha')
    const row = rowNamed(
      buildCatalogSections(inputs({ skills: { kind: 'ready', items: [listed] } })),
      'alpha'
    )
    expect(row.target).toEqual({ kind: 'skill', skill: listed })
  })
})

describe('the item statuses', () => {
  it('shows Git as Installed and owned when it is installed', () => {
    const row = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ git: 'installed' }) })),
      'Git'
    )
    expect(row.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(row.owned).toBe(true)
    expect(row.target).toEqual({ kind: 'item', id: 'git' })
  })

  it('offers Install for Git that is not installed, and does not own it', () => {
    const row = rowNamed(buildCatalogSections(inputs()), 'Git')
    expect(row.status).toEqual({ kind: 'action', label: 'Install' })
    expect(row.owned).toBe(false)
  })

  it('shows checking and could-not-check as pending, never as a done or action state', () => {
    const checking = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ git: 'checking' }) })),
      'Git'
    )
    expect(checking.status).toEqual({ kind: 'pending', label: 'Checking…' })
    const unknown = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ engram: 'unknown' }) })),
      'Engram'
    )
    expect(unknown.status).toEqual({ kind: 'pending', label: 'Could not check' })
  })

  it('shows Engram as Installed when connected and Install otherwise', () => {
    const connected = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ engram: 'connected' }) })),
      'Engram'
    )
    expect(connected.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(connected.owned).toBe(true)
    expect(rowNamed(buildCatalogSections(inputs()), 'Engram').status).toEqual({
      kind: 'action',
      label: 'Install'
    })
  })

  it('shows GitHub as Connected when signed in, and Connect otherwise', () => {
    const signedIn = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ github: 'signed-in' }) })),
      'GitHub'
    )
    expect(signedIn.status).toEqual({ kind: 'done', label: 'Connected' })
    expect(signedIn.owned).toBe(true)
    expect(signedIn.service).toBe(true)
    const notSigned = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ github: 'not-signed-in' }) })),
      'GitHub'
    )
    expect(notSigned.status).toEqual({ kind: 'action', label: 'Connect' })
    expect(notSigned.owned).toBe(false)
  })

  it('shows OpenMetadata as Connected or Connect, and the desktop-only note without a bridge', () => {
    const connected = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ openmetadata: 'connected' }) })),
      'OpenMetadata'
    )
    expect(connected.status).toEqual({ kind: 'done', label: 'Connected' })
    const desktopOnly = rowNamed(
      buildCatalogSections(inputs({ badgeFor: badges({ openmetadata: 'desktop-only' }) })),
      'OpenMetadata'
    )
    expect(desktopOnly.status).toEqual({ kind: 'pending', label: 'Available in the desktop app' })
  })
})

describe('agents, skills and custom items', () => {
  it('lists the agents in the order given, each with Found or Install', () => {
    const agents = sectionNamed(buildCatalogSections(inputs()), 'Agents').rows
    expect(agents.map((row) => row.name)).toEqual(['Claude Code', 'Codex'])
    expect(agents[1]?.status).toEqual({ kind: 'found', label: 'Found' })
    expect(agents[1]?.owned).toBe(true)
    expect(agents[0]?.status).toEqual({ kind: 'action', label: 'Install' })
    expect(agents[0]?.target).toEqual({ kind: 'agent', agent: 'claude' })
  })

  it('shows a placeholder instead of agent rows while detection runs', () => {
    const section = sectionNamed(
      buildCatalogSections(inputs({ detectedAgents: { kind: 'loading' } })),
      'Agents'
    )
    expect(section.rows).toEqual([])
    expect(section.placeholder).toBe('Checking this computer…')
  })

  it('says a remote host was not checked, instead of showing this computer', () => {
    const section = sectionNamed(
      buildCatalogSections(
        inputs({ hostLabel: 'Dev server', detectedAgents: { kind: 'unavailable' } })
      ),
      'Agents'
    )
    expect(section.rows).toEqual([])
    expect(section.placeholder).toBe('Not checked on Dev server yet.')
  })

  it('lists the skills found, each as Installed with its source when it has no description', () => {
    const skills = sectionNamed(
      buildCatalogSections(inputs({ skills: { kind: 'ready', items: [skill('alpha')] } })),
      'Skills'
    )
    expect(skills.rows).toHaveLength(1)
    expect(skills.rows[0]?.name).toBe('alpha')
    expect(skills.rows[0]?.description).toBe('Agent skills home')
    expect(skills.rows[0]?.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(skills.placeholder).toBeNull()
  })

  it('says no skills were found when the scan is empty', () => {
    const skills = sectionNamed(buildCatalogSections(inputs()), 'Skills')
    expect(skills.rows).toEqual([])
    expect(skills.placeholder).toBe('No skills found on This computer.')
  })

  it('places a found custom tool under Tools as Installed and owned', () => {
    const sections = buildCatalogSections(
      inputs({ custom: { kind: 'ready', items: [custom({ id: 'c1', name: 'Mytool' })] } })
    )
    const row = rowNamed(sections, 'Mytool')
    expect(sectionNamed(sections, 'Tools').rows).toContain(row)
    expect(row.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(row.owned).toBe(true)
    expect(row.description).toBe('mytool --version')
    expect(row.target).toBeNull()
    expect(row.customId).toBe('c1')
  })

  it('offers Install for a missing custom agent under Agents, and shows Installing while it runs', () => {
    const missing = rowNamed(
      buildCatalogSections(
        inputs({
          custom: {
            kind: 'ready',
            items: [custom({ id: 'c2', name: 'Helper', kind: 'agent', presence: 'missing' })]
          }
        })
      ),
      'Helper'
    )
    expect(missing.section).toBe('agents')
    expect(missing.status).toEqual({ kind: 'action', label: 'Install' })
    expect(missing.customId).toBe('c2')

    const installing = rowNamed(
      buildCatalogSections(
        inputs({
          custom: {
            kind: 'ready',
            items: [custom({ id: 'c2', name: 'Helper', kind: 'agent', presence: 'missing' })]
          },
          installingCustomIds: new Set(['c2'])
        })
      ),
      'Helper'
    )
    expect(installing.status).toEqual({ kind: 'pending', label: 'Installing…' })
    expect(installing.owned).toBe(false)
  })

  it('treats a custom item that cannot be checked as Could not check', () => {
    const row = rowNamed(
      buildCatalogSections(
        inputs({
          custom: {
            kind: 'ready',
            items: [custom({ id: 'c3', name: 'Odd', presence: 'unverifiable' })]
          }
        })
      ),
      'Odd'
    )
    expect(row.status).toEqual({ kind: 'pending', label: 'Could not check' })
  })
})

describe('owned rows and search', () => {
  it('returns the owned rows in section order', () => {
    const sections = buildCatalogSections(
      inputs({
        badgeFor: badges({ git: 'installed', github: 'signed-in' }),
        skills: { kind: 'ready', items: [skill('alpha')] }
      })
    )
    expect(ownedRows(sections).map((row) => row.name)).toEqual(['Git', 'Codex', 'alpha', 'GitHub'])
  })

  it('matches the name or the description, ignoring case, and matches everything when empty', () => {
    const row = rowNamed(buildCatalogSections(inputs()), 'Git')
    expect(rowMatchesQuery(row, '')).toBe(true)
    expect(rowMatchesQuery(row, 'GIT')).toBe(true)
    expect(rowMatchesQuery(row, 'workspaces')).toBe(true)
    expect(rowMatchesQuery(row, 'engram')).toBe(false)
  })
})
