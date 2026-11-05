import { describe, expect, it, vi } from 'vitest'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { MarketplaceItemId } from './marketplace-catalog'
import {
  buildCatalogSections,
  ownedRows,
  rowMatchesQuery,
  type CatalogAgentEntry,
  type CatalogBadge,
  type CatalogBuildInputs,
  type CatalogCheck,
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

const PV_VPS = 'pv-vps'
const BOARD_SKILL_NAMES = ['Browser use', 'Computer use', 'Linear', 'Orchestration', 'Price check']
const BOARD_AGENTS: readonly { id: TuiAgent; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'pi', label: 'Gentle Shell' }
]

function badges(
  states: Partial<Record<MarketplaceItemId, CatalogBadge>>
): CatalogBuildInputs['badgeFor'] {
  return (id) => states[id] ?? 'not-installed'
}

function agentsWith(check: (id: TuiAgent) => CatalogCheck<boolean>): CatalogAgentEntry[] {
  return BOARD_AGENTS.map((entry) => ({ ...entry, check: check(entry.id) }))
}

function readyAgents(foundIds: readonly TuiAgent[]): CatalogAgentEntry[] {
  return agentsWith((id) => ({ kind: 'ready', value: foundIds.includes(id) }))
}

function inputs(overrides: Partial<CatalogBuildInputs> = {}): CatalogBuildInputs {
  return {
    hostLabel: 'This computer',
    badgeFor: badges({}),
    agents: readyAgents(['codex']),
    skills: { kind: 'ready', value: [] },
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
      buildCatalogSections(inputs({ skills: { kind: 'ready', value: [listed] } })),
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

describe('agents, skills and custom items on this computer', () => {
  it('lists the four board agents in board order, each with Found or Install', () => {
    const agents = sectionNamed(buildCatalogSections(inputs()), 'Agents').rows
    expect(agents.map((row) => row.name)).toEqual([
      'Claude Code',
      'Codex',
      'Antigravity',
      'Gentle Shell'
    ])
    expect(agents[1]?.status).toEqual({ kind: 'found', label: 'Found' })
    expect(agents[1]?.owned).toBe(true)
    expect(agents[0]?.status).toEqual({ kind: 'action', label: 'Install' })
    expect(agents[0]?.target).toEqual({ kind: 'agent', agent: 'claude' })
  })

  it('shows each agent as Checking while detection runs, and never an empty section', () => {
    const section = sectionNamed(
      buildCatalogSections(inputs({ agents: agentsWith(() => ({ kind: 'loading' })) })),
      'Agents'
    )
    expect(section.rows.map((row) => row.status)).toEqual(
      BOARD_AGENTS.map(() => ({ kind: 'pending', label: 'Checking…' }))
    )
    expect(section.placeholder).toBeNull()
  })

  it('lists the skills found, each as Installed with its source when it has no description', () => {
    const skills = sectionNamed(
      buildCatalogSections(inputs({ skills: { kind: 'ready', value: [skill('alpha')] } })),
      'Skills'
    )
    const alpha = skills.rows.find((row) => row.name === 'alpha')
    expect(alpha?.description).toBe('Agent skills home')
    expect(alpha?.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(skills.placeholder).toBeNull()
  })

  it('keeps the board skills listed when the scan finds none, each with Install', () => {
    const skills = sectionNamed(buildCatalogSections(inputs()), 'Skills')
    expect(skills.rows.map((row) => row.name)).toEqual(BOARD_SKILL_NAMES)
    expect(
      skills.rows.every((row) => row.status.kind === 'action' && row.status.label === 'Install')
    ).toBe(true)
    expect(skills.placeholder).toBeNull()
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

describe('a picked remote host', () => {
  it('lists all four board agents, Found where its detection finds them and Install for the rest', () => {
    const agents = sectionNamed(
      buildCatalogSections(inputs({ hostLabel: PV_VPS, agents: readyAgents(['codex']) })),
      'Agents'
    ).rows
    expect(agents.map((row) => row.name)).toEqual([
      'Claude Code',
      'Codex',
      'Antigravity',
      'Gentle Shell'
    ])
    expect(agents.map((row) => row.status)).toEqual([
      { kind: 'action', label: 'Install' },
      { kind: 'found', label: 'Found' },
      { kind: 'action', label: 'Install' },
      { kind: 'action', label: 'Install' }
    ])
    expect(agents[1]?.owned).toBe(true)
  })

  it('shows each agent row as Checking while the host detection runs', () => {
    const section = sectionNamed(
      buildCatalogSections(
        inputs({ hostLabel: PV_VPS, agents: agentsWith(() => ({ kind: 'loading' })) })
      ),
      'Agents'
    )
    expect(section.rows.map((row) => row.status)).toEqual(
      BOARD_AGENTS.map(() => ({ kind: 'pending', label: 'Checking…' }))
    )
    expect(section.placeholder).toBeNull()
  })

  it('shows Could not check on each agent row when the host detection failed', () => {
    const section = sectionNamed(
      buildCatalogSections(
        inputs({ hostLabel: PV_VPS, agents: agentsWith(() => ({ kind: 'failed' })) })
      ),
      'Agents'
    )
    expect(section.rows.map((row) => row.status)).toEqual(
      BOARD_AGENTS.map(() => ({ kind: 'pending', label: 'Could not check' }))
    )
  })

  it('shows Update MassOrca on the host only on the rows whose check that host predates', () => {
    const section = sectionNamed(
      buildCatalogSections(
        inputs({
          hostLabel: PV_VPS,
          agents: agentsWith((id) =>
            id === 'pi' ? { kind: 'update-required' } : { kind: 'ready', value: true }
          )
        })
      ),
      'Agents'
    )
    expect(section.rows.map((row) => row.status)).toEqual([
      { kind: 'found', label: 'Found' },
      { kind: 'found', label: 'Found' },
      { kind: 'found', label: 'Found' },
      { kind: 'pending', label: 'Update MassOrca on pv-vps' }
    ])
  })

  it('shows Update MassOrca on the host for a tool row whose check the host predates', () => {
    const sections = buildCatalogSections(
      inputs({
        hostLabel: PV_VPS,
        badgeFor: badges({ git: 'update-required' }),
        cli: { gh: 'update-required', gitlab: 'unknown' }
      })
    )
    expect(rowNamed(sections, 'Git').status).toEqual({
      kind: 'pending',
      label: 'Update MassOrca on pv-vps'
    })
    expect(rowNamed(sections, 'GitHub CLI').status).toEqual({
      kind: 'pending',
      label: 'Update MassOrca on pv-vps'
    })
  })

  it('lists the board skills while the host skills are checked, failed or out of date', () => {
    const cases: [CatalogCheck<readonly DiscoveredSkill[]>, string][] = [
      [{ kind: 'loading' }, 'Checking…'],
      [{ kind: 'failed' }, 'Could not check'],
      [{ kind: 'update-required' }, 'Update MassOrca on pv-vps']
    ]
    for (const [skills, label] of cases) {
      const section = sectionNamed(
        buildCatalogSections(inputs({ hostLabel: PV_VPS, skills })),
        'Skills'
      )
      expect(section.rows.map((row) => row.name)).toEqual(BOARD_SKILL_NAMES)
      expect(section.rows.map((row) => row.status)).toEqual(
        BOARD_SKILL_NAMES.map(() => ({ kind: 'pending', label }))
      )
    }
  })

  it('lists the discovered skills first, and a board skill the host already lists shows its state', () => {
    const skills = sectionNamed(
      buildCatalogSections(
        inputs({
          hostLabel: PV_VPS,
          skills: { kind: 'ready', value: [skill('browser-use'), skill('alpha')] }
        })
      ),
      'Skills'
    )
    expect(skills.rows.map((row) => row.name)).toEqual([
      'browser-use',
      'alpha',
      'Computer use',
      'Linear',
      'Orchestration',
      'Price check'
    ])
    expect(skills.rows[0]?.status).toEqual({ kind: 'done', label: 'Installed' })
    expect(skills.rows[2]?.status).toEqual({ kind: 'action', label: 'Install' })
  })

  it('never leaves a section empty, whatever this computer or the host answered', () => {
    const agentChecks: CatalogCheck<boolean>[] = [
      { kind: 'loading' },
      { kind: 'failed' },
      { kind: 'update-required' },
      { kind: 'ready', value: false }
    ]
    const skillChecks: CatalogCheck<readonly DiscoveredSkill[]>[] = [
      { kind: 'loading' },
      { kind: 'failed' },
      { kind: 'update-required' },
      { kind: 'ready', value: [] }
    ]
    for (const hostLabel of ['This computer', PV_VPS]) {
      for (const check of agentChecks) {
        for (const skillCheck of skillChecks) {
          const sections = buildCatalogSections(
            inputs({ hostLabel, agents: agentsWith(() => check), skills: skillCheck })
          )
          for (const section of sections) {
            expect(section.rows.length, `${hostLabel} ${section.name}`).toBeGreaterThan(0)
            expect(section.placeholder).toBeNull()
          }
        }
      }
    }
  })
})

describe('owned rows and search', () => {
  it('returns the owned rows in section order', () => {
    const sections = buildCatalogSections(
      inputs({
        badgeFor: badges({ git: 'installed', github: 'signed-in' }),
        skills: { kind: 'ready', value: [skill('alpha')] }
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
