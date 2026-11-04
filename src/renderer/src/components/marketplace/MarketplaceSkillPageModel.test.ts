import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  SKILL_INSTALL_PROVIDERS,
  type SkillInstallProviderDefinition
} from '../../../../shared/skill-install-providers'
import type { DiscoveredSkill } from '../../../../shared/skills'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const {
  marketplaceSkillBots,
  marketplaceSkillFromDiscovered,
  marketplaceSkillReachesAgent,
  marketplaceSkillTeams
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

describe('marketplaceSkillFromDiscovered', () => {
  it('reads the agents from every root that holds the skill', () => {
    const owners = new Map([
      ['/home/dev/.claude/skills', 'claude'],
      ['/home/dev/.agents/skills', 'shared']
    ])
    expect(marketplaceSkillFromDiscovered(skill(), owners)).toEqual({
      name: 'browser-use',
      description: 'Opens pages.',
      installed: true,
      agentIds: ['claude', 'shared'],
      installLink: '',
      origin: {
        kind: 'folder',
        name: 'Claude home',
        detail: '/home/dev/.claude/skills/browser-use'
      }
    })
  })

  it('names a bundled skill as the MassOrca skills pool', () => {
    expect(
      marketplaceSkillFromDiscovered(skill({ sourceKind: 'bundled' }), new Map()).origin
    ).toEqual({
      kind: 'pool',
      name: 'MassOrca skills pool',
      detail: 'Bundled with this version of MassOrca.'
    })
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
