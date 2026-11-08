import { describe, expect, it, vi } from 'vitest'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill, SkillDiscoveryResult } from '../../../../shared/skills'
import type { CatalogRow, CatalogRowTarget } from './MarketplaceCatalogRows'
import {
  MARKETPLACE_ROW_BLOCK_TEXT,
  planMarketplaceRowPage,
  resolveMarketplaceRowPage,
  skillPageOutcome,
  type MarketplaceRowPageHost,
  type MarketplaceSkillScan
} from './marketplace-row-page-resolver'

const NO_HOST: MarketplaceRowPageHost = { pickedTarget: null, focusedRuntime: null }
const FOCUSED_LOCAL: MarketplaceRowPageHost = {
  pickedTarget: null,
  focusedRuntime: { kind: 'local' }
}
const SSH_HOST: MarketplaceRowPageHost = {
  pickedTarget: { kind: 'ssh', connectionId: 'ssh-1', label: 'build-box' },
  focusedRuntime: null
}

function rowFor(target: CatalogRowTarget | null): CatalogRow {
  return {
    key: 'test-row',
    section: 'skills',
    name: 'Test row',
    description: '',
    icon: { kind: 'skill' },
    status: { kind: 'action', label: 'Install' },
    target,
    owned: false,
    service: false,
    customId: null
  }
}

function discovered(name: string): DiscoveredSkill {
  return {
    id: `home:${name}`,
    name,
    description: null,
    providers: ['claude'],
    sourceKind: 'home',
    sourceLabel: 'Claude',
    rootPath: '/home/me/.claude/skills',
    directoryPath: `/home/me/.claude/skills/${name}`,
    skillFilePath: `/home/me/.claude/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null
  }
}

function scanReturning(skills: DiscoveredSkill[]): MarketplaceSkillScan {
  const result: SkillDiscoveryResult = { skills, sources: [], scannedAt: 1 }
  return vi.fn(() => Promise.resolve(result))
}

function customSkill(name: string): MarketplaceCustomItemStatus {
  return {
    id: `custom-${name}`,
    kind: 'skill',
    name,
    checkCommand: null,
    install: {},
    skillUrl: 'https://example.com/skill.git',
    createdAt: 1,
    presence: 'missing'
  }
}

describe('planMarketplaceRowPage for rows that open without a scan', () => {
  it('a row with no target has no page and never scans a host', () => {
    const scan = vi.fn(() => null)
    expect(planMarketplaceRowPage(rowFor(null), FOCUSED_LOCAL, scan)).toEqual({
      kind: 'resolved',
      resolution: { opens: false, reason: 'no-target' }
    })
    expect(scan).not.toHaveBeenCalled()
  })

  it('an item row opens its page, and the Git row opens the detail page', () => {
    expect(planMarketplaceRowPage(rowFor({ kind: 'item', id: 'git' }), NO_HOST)).toEqual({
      kind: 'resolved',
      resolution: { opens: true, pageKind: 'item-detail' }
    })
    expect(planMarketplaceRowPage(rowFor({ kind: 'item', id: 'openmetadata' }), NO_HOST)).toEqual({
      kind: 'resolved',
      resolution: { opens: true, pageKind: 'item-app' }
    })
  })

  it('integration, built-in and agent rows open their own page kinds', () => {
    const cases: [CatalogRowTarget, string][] = [
      [{ kind: 'integration', id: 'gitlab' }, 'integration:gitlab'],
      [{ kind: 'integration', id: 'linear' }, 'integration:linear'],
      [{ kind: 'built-in', id: 'prototype' }, 'built-in'],
      [{ kind: 'agent', agent: 'claude' }, 'agent']
    ]
    for (const [target, pageKind] of cases) {
      expect(planMarketplaceRowPage(rowFor(target), NO_HOST)).toEqual({
        kind: 'resolved',
        resolution: { opens: true, pageKind }
      })
    }
  })

  it('opens every board tool, custom item and custom placeholder row on its own page kind', () => {
    const tool: MarketplaceCustomItemStatus = {
      id: 'c1',
      kind: 'tool',
      name: 'Mytool',
      checkCommand: ['mytool', '--version'],
      install: {},
      createdAt: 1,
      presence: 'missing'
    }
    const cases: [CatalogRowTarget, string][] = [
      [{ kind: 'board-tool', id: 'gh' }, 'board-tool'],
      [{ kind: 'board-tool', id: 'node' }, 'board-tool'],
      [{ kind: 'custom-item', item: tool }, 'custom-item'],
      [{ kind: 'custom-unavailable', itemKind: 'tool' }, 'custom-unavailable']
    ]
    for (const [target, pageKind] of cases) {
      expect(planMarketplaceRowPage(rowFor(target), NO_HOST)).toEqual({
        kind: 'resolved',
        resolution: { opens: true, pageKind }
      })
    }
  })

  it('opens an unlisted board skill after its scan, even with no copy on the host', async () => {
    const plan = planMarketplaceRowPage(
      rowFor({
        kind: 'board-skill',
        name: 'browser-use',
        description: 'Agents use the browser pane.'
      }),
      FOCUSED_LOCAL,
      scanReturning([])
    )
    expect(plan.kind).toBe('skill')
    if (plan.kind !== 'skill') {
      return
    }
    const outcome = skillPageOutcome(plan.listing, await plan.scan)
    expect(outcome).toMatchObject({
      opens: true,
      page: { skill: { name: 'browser-use', installed: false } }
    })
  })
})

describe('planMarketplaceRowPage for skill rows', () => {
  it('blocks silently when there is no host to scan', () => {
    const scan = vi.fn(() => null)
    expect(
      planMarketplaceRowPage(rowFor({ kind: 'skill', skill: discovered('review') }), NO_HOST, scan)
    ).toEqual({ kind: 'resolved', resolution: { opens: false, reason: 'no-skill-host' } })
  })

  it('blocks with the SSH reason when the picked host is SSH', () => {
    const scan = vi.fn(() => null)
    expect(
      planMarketplaceRowPage(rowFor({ kind: 'skill', skill: discovered('review') }), SSH_HOST, scan)
    ).toEqual({ kind: 'resolved', resolution: { opens: false, reason: 'ssh-no-skill-scan' } })
  })

  it('scans the focused runtime when no host is picked', () => {
    const scan = scanReturning([discovered('review')])
    planMarketplaceRowPage(
      rowFor({ kind: 'skill', skill: discovered('review') }),
      FOCUSED_LOCAL,
      scan
    )
    expect(scan).toHaveBeenCalledWith(null, { kind: 'local' })
  })

  it('opens a discovered skill that the scan finds on the host', async () => {
    const row = rowFor({ kind: 'skill', skill: discovered('review') })
    expect(
      await resolveMarketplaceRowPage(row, FOCUSED_LOCAL, scanReturning([discovered('review')]))
    ).toEqual({ opens: true, pageKind: 'skill' })
  })

  it('blocks a discovered skill that the scan no longer lists', async () => {
    const row = rowFor({ kind: 'skill', skill: discovered('review') })
    expect(
      await resolveMarketplaceRowPage(row, FOCUSED_LOCAL, scanReturning([discovered('other')]))
    ).toEqual({ opens: false, reason: 'skill-not-on-host' })
  })

  it('blocks as scan-failed when the scan rejects', async () => {
    const failing: MarketplaceSkillScan = () => Promise.reject(new Error('disk gone'))
    const row = rowFor({ kind: 'skill', skill: discovered('review') })
    expect(await resolveMarketplaceRowPage(row, FOCUSED_LOCAL, failing)).toEqual({
      opens: false,
      reason: 'scan-failed'
    })
  })

  it('opens a custom skill even when no copy is on the host', async () => {
    const row = rowFor({ kind: 'custom-skill', item: customSkill('deploy') })
    expect(await resolveMarketplaceRowPage(row, FOCUSED_LOCAL, scanReturning([]))).toEqual({
      opens: true,
      pageKind: 'skill'
    })
  })
})

describe('skillPageOutcome', () => {
  it('returns the copies the skill page reads for a skill the scan found', () => {
    const outcome = skillPageOutcome(
      { kind: 'discovered', skill: discovered('review') },
      { skills: [discovered('review')], sources: [], scannedAt: 1 }
    )
    expect(outcome).toMatchObject({
      opens: true,
      page: { copies: [expect.objectContaining({ name: 'review' })] }
    })
  })
})

describe('MARKETPLACE_ROW_BLOCK_TEXT', () => {
  it('gives each stable reason its English text', () => {
    expect(MARKETPLACE_ROW_BLOCK_TEXT).toEqual({
      'no-target': 'This row has no page',
      'no-skill-host': 'No host to scan skills on',
      'ssh-no-skill-scan': 'SSH hosts cannot list skills yet',
      'scan-failed': 'The skill scan failed',
      'skill-not-on-host': 'The skill is not on this host'
    })
  })
})
