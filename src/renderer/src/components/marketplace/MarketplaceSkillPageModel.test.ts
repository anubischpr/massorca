import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  SKILL_INSTALL_PROVIDERS,
  type SkillInstallProviderDefinition
} from '../../../../shared/skill-install-providers'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const {
  marketplaceSkillBots,
  marketplaceSkillPageFromScan,
  marketplaceSkillReachesAgent,
  marketplaceSkillTeams,
  skillCopiesNamed
} = await import('./MarketplaceSkillPageModel')

function skill(overrides: Partial<DiscoveredSkill> = {}): DiscoveredSkill {
  return {
    id: 'skill-browser',
    name: 'browser-use',
    description: 'Opens pages.',
    providers: ['claude'],
    sourceKind: 'home',
    sourceLabel: 'Claude home',
    rootPath: '/home/dev/.claude/skills',
    rootPaths: ['/home/dev/.claude/skills', '/home/dev/.agents/skills'],
    directoryPath: '/home/dev/.claude/skills/browser-use',
    skillFilePath: '/home/dev/.claude/skills/browser-use/SKILL.md',
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

/** The same skill in the Codex folder, which is not the one the list kept. */
function codexCopy(): DiscoveredSkill {
  return skill({
    id: 'skill-codex-browser',
    sourceLabel: 'Codex home',
    rootPath: '/home/dev/.codex/skills',
    rootPaths: ['/home/dev/.codex/skills'],
    directoryPath: '/home/dev/.codex/skills/browser-use',
    skillFilePath: '/home/dev/.codex/skills/browser-use/SKILL.md',
    installed: false
  })
}

const OWNERS = new Map([
  ['/home/dev/.claude/skills', 'claude'],
  ['/home/dev/.agents/skills', 'shared'],
  ['/home/dev/.codex/skills', 'codex']
])

function customItem(
  presence: MarketplaceCustomItemStatus['presence'],
  name = 'Team skill'
): MarketplaceCustomItemStatus {
  return {
    id: 'team',
    kind: 'skill',
    name,
    checkCommand: null,
    install: {},
    skillUrl: 'https://example.com/skills/team',
    createdAt: 1,
    presence
  }
}

const TEAMS: BotTeam[] = [
  {
    id: 'mk',
    name: 'Marketing',
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: [
      {
        id: 'b1',
        name: 'Iris',
        job: '',
        agent: 'claude',
        modelMode: 'auto',
        model: null,
        effort: null,
        skills: ['browser-use']
      },
      {
        id: 'b2',
        name: 'Ana',
        job: '',
        agent: 'claude',
        modelMode: 'auto',
        model: null,
        effort: null,
        skills: []
      }
    ]
  },
  {
    id: 'dev',
    name: 'Development',
    purpose: '',
    character: 'circle',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: [
      {
        id: 'b3',
        name: 'Max',
        job: '',
        agent: 'codex',
        modelMode: 'auto',
        model: null,
        effort: null,
        skills: []
      }
    ]
  }
]

describe('marketplaceSkillPageFromScan', () => {
  it('reads every copy of the skill, and the agents of all the roots that hold them', () => {
    const page = marketplaceSkillPageFromScan(
      { kind: 'discovered', skill: skill() },
      [skill(), codexCopy(), skill({ id: 'other', name: 'sdd-init' })],
      OWNERS
    )
    expect(page?.copies.map((copy) => copy.id)).toEqual(['skill-browser', 'skill-codex-browser'])
    expect(page?.skill).toEqual({
      name: 'browser-use',
      description: 'Opens pages.',
      installed: true,
      agentIds: ['claude', 'shared', 'codex'],
      installLink: '',
      folders: ['browser-use'],
      origin: {
        kind: 'folder',
        name: 'Claude home',
        detail: '/home/dev/.claude/skills/browser-use'
      }
    })
  })

  it('reads a skill as installed when any of its copies is', () => {
    const page = marketplaceSkillPageFromScan(
      { kind: 'discovered', skill: codexCopy() },
      [skill({ installed: true }), codexCopy()],
      OWNERS
    )
    expect(page?.skill.installed).toBe(true)
  })

  it('reads no page when the scan no longer holds the skill', () => {
    expect(
      marketplaceSkillPageFromScan(
        { kind: 'discovered', skill: skill() },
        [skill({ name: 'x' })],
        OWNERS
      )
    ).toBeNull()
  })

  it('names a bundled skill as the MassOrca skills pool', () => {
    const bundled = skill({ sourceKind: 'bundled' })
    expect(
      marketplaceSkillPageFromScan({ kind: 'discovered', skill: bundled }, [bundled], new Map())
        ?.skill.origin
    ).toEqual({
      kind: 'pool',
      name: 'MassOrca skills pool',
      detail: 'Bundled with this version of MassOrca.'
    })
  })

  it('opens a custom skill that is installed with its name and link, and no copy to remove', () => {
    expect(
      marketplaceSkillPageFromScan({ kind: 'custom', item: customItem('found') }, [], OWNERS)
    ).toEqual({
      skill: {
        name: 'Team skill',
        description: null,
        installed: true,
        agentIds: [],
        installLink: 'https://example.com/skills/team',
        folders: [],
        origin: {
          kind: 'custom',
          name: 'Added by you',
          detail: 'https://example.com/skills/team'
        }
      },
      copies: []
    })
  })

  it('opens a custom skill that is not installed on its install link', () => {
    const page = marketplaceSkillPageFromScan(
      { kind: 'custom', item: customItem('missing') },
      [],
      OWNERS
    )
    expect(page?.skill.installed).toBe(false)
    expect(page?.skill.installLink).toBe('https://example.com/skills/team')
  })

  it('finds the copies of a custom skill by its name on the host', () => {
    const page = marketplaceSkillPageFromScan(
      { kind: 'custom', item: customItem('found', 'browser use') },
      [skill(), codexCopy()],
      OWNERS
    )
    expect(page?.copies.map((copy) => copy.id)).toEqual(['skill-browser', 'skill-codex-browser'])
  })
})

describe('skillCopiesNamed', () => {
  it('matches a skill folder and its readable name as the same skill', () => {
    const copies = skillCopiesNamed(
      [skill(), skill({ id: 'spaced', name: 'Browser use' }), skill({ id: 'other', name: 'x' })],
      'browser-use'
    )
    expect(copies.map((copy) => copy.id)).toEqual(['skill-browser', 'spaced'])
  })
})

describe('marketplaceSkillReachesAgent', () => {
  const provider = (id: string): SkillInstallProviderDefinition => {
    const found = SKILL_INSTALL_PROVIDERS.find((entry) => entry.id === id)
    if (!found) {
      throw new Error(`Unknown provider ${id}`)
    }
    return found
  }

  it('counts the shared root for agents that read it, and owned roots for the rest', () => {
    expect(marketplaceSkillReachesAgent(provider('codex'), ['shared'])).toBe(true)
    expect(marketplaceSkillReachesAgent(provider('claude'), ['shared'])).toBe(false)
    expect(marketplaceSkillReachesAgent(provider('claude'), ['claude'])).toBe(true)
  })
})

describe('bot team counts', () => {
  it('counts bots per team and marks the teams whose bots use the skill', () => {
    expect(marketplaceSkillTeams(TEAMS, 'browser-use')).toEqual([
      { id: 'mk', name: 'Marketing', botCount: 2, usesSkill: true },
      { id: 'dev', name: 'Development', botCount: 1, usesSkill: false }
    ])
  })

  it('lists the bots that use the skill with their team', () => {
    expect(marketplaceSkillBots(TEAMS, 'browser-use')).toEqual(['Iris · Marketing'])
  })
})
