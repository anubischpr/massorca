import { describe, expect, it } from 'vitest'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { markMarketplaceManagedSkills } from './marketplace-managed-skills'

function skill(name: string, overrides: Partial<DiscoveredSkill> = {}): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/home/dev/.claude/skills',
    directoryPath: `/home/dev/.claude/skills/${name}`,
    skillFilePath: `/home/dev/.claude/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function install(name: string, overrides: Partial<ManagedSkillInstall> = {}): ManagedSkillInstall {
  return {
    name,
    packageId: 'pkg-calendar',
    versionId: 'v1',
    packageDigest: 'a'.repeat(64),
    scope: 'global',
    destinationIdentity: 'global:local',
    destination: { scope: 'global' },
    installedAt: '2026-11-01T00:00:00.000Z',
    state: 'unchanged',
    ...overrides
  }
}

describe('markMarketplaceManagedSkills', () => {
  it('marks a home skill whose folder a managed install names', () => {
    const [marked] = markMarketplaceManagedSkills([skill('calendar')], [install('calendar')])
    expect(marked?.source).toBe('marketplace')
  })

  it('leaves a home skill unmarked when no managed install names its folder', () => {
    const [plain] = markMarketplaceManagedSkills([skill('sdd-init')], [install('calendar')])
    expect(plain?.source).toBeUndefined()
  })

  it('keeps a workspace install apart from a home skill of the same name', () => {
    const [plain] = markMarketplaceManagedSkills(
      [skill('calendar')],
      [install('calendar', { scope: 'workspace' })]
    )
    expect(plain?.source).toBeUndefined()
  })

  it('marks a repo skill that a workspace install names', () => {
    const [marked] = markMarketplaceManagedSkills(
      [
        skill('calendar', {
          sourceKind: 'repo',
          rootPath: '/work/app/.claude/skills',
          directoryPath: '/work/app/.claude/skills/calendar'
        })
      ],
      [install('calendar', { scope: 'workspace' })]
    )
    expect(marked?.source).toBe('marketplace')
  })

  it('ignores an install whose files are missing, and keeps a modified one', () => {
    const missing = markMarketplaceManagedSkills(
      [skill('calendar')],
      [install('calendar', { state: 'missing' })]
    )
    expect(missing[0]?.source).toBeUndefined()
    const modified = markMarketplaceManagedSkills(
      [skill('calendar')],
      [install('calendar', { state: 'modified' })]
    )
    expect(modified[0]?.source).toBe('marketplace')
  })

  it('matches a Windows folder regardless of its separators and letter case', () => {
    const [marked] = markMarketplaceManagedSkills(
      [
        skill('Calendar', {
          rootPath: 'C:\\Users\\dev\\.claude\\skills',
          directoryPath: 'C:\\Users\\dev\\.claude\\skills\\Calendar',
          skillFilePath: 'C:\\Users\\dev\\.claude\\skills\\Calendar\\SKILL.md'
        })
      ],
      [install('calendar')]
    )
    expect(marked?.source).toBe('marketplace')
  })

  it('never marks a bundled or plugin skill, even one that shares a managed folder name', () => {
    const skills = [
      skill('calendar', { sourceKind: 'bundled', rootPath: '/home/dev/.codex/skills/.system' }),
      skill('calendar', { sourceKind: 'plugin', rootPath: '/home/dev/.claude/plugins/expo/skills' })
    ]
    const result = markMarketplaceManagedSkills(skills, [install('calendar')])
    expect(result.map((entry) => entry.source)).toEqual([undefined, undefined])
  })

  it('returns the same skill objects when no install matches', () => {
    const skills = [skill('sdd-init')]
    expect(markMarketplaceManagedSkills(skills, [install('calendar')])[0]).toBe(skills[0])
  })
})
