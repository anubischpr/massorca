import { describe, expect, it } from 'vitest'
import type { MarketplaceAppStatus } from '../../../src/shared/marketplace-apps'
import { buildCatalogItems } from './marketplace-catalog-items'
import {
  catalogActionLabel,
  catalogActionTone,
  catalogBadgeTone,
  catalogSections,
  catalogYourApps,
  isCatalogAgentId,
  type CatalogSource
} from './marketplace-catalog-model'

function app(id: MarketplaceAppStatus['id'], connected: boolean): MarketplaceAppStatus {
  return { id, connected, agents: [] }
}

const EVERYTHING: CatalogSource = {
  apps: [app('engram', true), app('openmetadata', false), app('github', true)],
  tools: {
    git: false,
    gh: { installed: true, authenticated: true },
    glab: { installed: true, authenticated: false }
  },
  agentIds: new Set(['claude', 'codex']),
  piRuntimes: ['gentle-shell']
}

const BOARD_ONLY_IDS = [
  'node',
  'browser',
  'linear',
  'orch',
  'price',
  'email',
  'calendar',
  'drive',
  'crm'
]

describe('buildCatalogItems', () => {
  it('lists every board group in board order, with the states the host reports', () => {
    const items = buildCatalogItems(EVERYTHING)

    expect(items.map((item) => item.id)).toEqual([
      'git',
      'gh',
      'node',
      'engram',
      'claude',
      'codex',
      'antigravity',
      'gentle-shell',
      'browser',
      'linear',
      'orch',
      'price',
      'openmetadata',
      'github',
      'gitlab',
      'email',
      'calendar',
      'drive',
      'crm'
    ])
    expect(Object.fromEntries(items.map((item) => [item.id, item.state]))).toEqual({
      git: 'missing',
      gh: 'installed',
      node: 'missing',
      engram: 'installed',
      claude: 'found',
      codex: 'found',
      antigravity: 'missing',
      'gentle-shell': 'found',
      browser: 'missing',
      linear: 'missing',
      orch: 'missing',
      price: 'missing',
      openmetadata: 'off',
      github: 'connected',
      gitlab: 'off',
      email: 'off',
      calendar: 'off',
      drive: 'off',
      crm: 'off'
    })
  })

  it('marks board rows as board-sourced with no tap target, and host rows as host-sourced', () => {
    const items = buildCatalogItems(EVERYTHING)

    for (const id of BOARD_ONLY_IDS) {
      expect(items.find((item) => item.id === id)).toMatchObject({
        source: 'board',
        openPath: null,
        actionPath: null
      })
    }
    expect(items.filter((item) => item.source === 'host').map((item) => item.id)).toEqual([
      'git',
      'gh',
      'engram',
      'claude',
      'codex',
      'antigravity',
      'gentle-shell',
      'openmetadata',
      'github',
      'gitlab'
    ])
  })

  it('keeps the board rows when a host read failed, and drops only the host rows it lacks', () => {
    const items = buildCatalogItems({
      apps: null,
      tools: null,
      agentIds: new Set(['claude']),
      piRuntimes: null
    })

    expect(items.map((item) => item.id)).toEqual([
      'node',
      'claude',
      'codex',
      'antigravity',
      'browser',
      'linear',
      'orch',
      'price',
      'email',
      'calendar',
      'drive',
      'crm'
    ])
  })

  it('keeps a missing Git from opening an install it cannot run, but still opens its screen', () => {
    const git = buildCatalogItems(EVERYTHING).find((item) => item.id === 'git')

    expect(git).toMatchObject({ state: 'missing', openPath: '/marketplace/git', actionPath: null })
  })

  it('gives host rows without a board screen no tap target', () => {
    const gh = buildCatalogItems(EVERYTHING).find((item) => item.id === 'gh')

    expect(gh).toMatchObject({ openPath: null, actionPath: null })
  })

  it('opens each agent on its own screen', () => {
    const claude = buildCatalogItems(EVERYTHING).find((item) => item.id === 'claude')

    expect(claude).toMatchObject({
      openPath: '/marketplace/agent/claude',
      actionPath: '/marketplace/agent/claude'
    })
  })

  it('shows Install on tools and skills and Connect on services for board rows, in neutral tones', () => {
    const boardRows = buildCatalogItems(EVERYTHING).filter((item) => item.source === 'board')

    expect(
      Object.fromEntries(boardRows.map((item) => [item.id, catalogActionLabel(item.state)]))
    ).toEqual({
      node: 'Install',
      browser: 'Install',
      linear: 'Install',
      orch: 'Install',
      price: 'Install',
      email: 'Connect',
      calendar: 'Connect',
      drive: 'Connect',
      crm: 'Connect'
    })
    expect(boardRows.every((item) => catalogActionTone(item.state) === 'secondary')).toBe(true)
    expect(boardRows.every((item) => item.actionPath === null)).toBe(true)
  })
})

describe('catalogSections', () => {
  const items = buildCatalogItems(EVERYTHING)

  it('shows every section with its count on the All chip, Skills included', () => {
    const sections = catalogSections(items, 'all', '')

    expect(sections.map((section) => [section.name, section.count])).toEqual([
      ['Tools', 4],
      ['Agents', 4],
      ['Skills', 4],
      ['Services', 7]
    ])
  })

  it('shows only the chosen kind', () => {
    const sections = catalogSections(items, 'agent', '')

    expect(sections.map((section) => section.name)).toEqual(['Agents'])
    expect(sections[0]?.items.map((item) => item.id)).toEqual([
      'claude',
      'codex',
      'antigravity',
      'gentle-shell'
    ])
  })

  it('shows the four board skills in board order', () => {
    const sections = catalogSections(items, 'skill', '')

    expect(sections[0]?.items.map((item) => item.id)).toEqual([
      'browser',
      'linear',
      'orch',
      'price'
    ])
  })

  it('matches the search text against names and descriptions', () => {
    const sections = catalogSections(items, 'all', ' git ')

    expect(sections.map((section) => [section.name, section.count])).toEqual([
      ['Tools', 2],
      ['Services', 2]
    ])
  })
})

describe('catalogYourApps', () => {
  it('counts only what the host reports, never the board rows', () => {
    const rows = catalogYourApps(buildCatalogItems(EVERYTHING))

    expect(rows.count).toBe(6)
    expect(rows.installed.map((item) => item.id)).toEqual([
      'gh',
      'engram',
      'claude',
      'codex',
      'gentle-shell'
    ])
    expect(rows.connected.map((item) => item.id)).toEqual(['github'])
  })
})

describe('catalog labels and tones', () => {
  it('uses the board labels and tones for each host state', () => {
    expect(catalogActionLabel('found')).toBe('Found')
    expect(catalogActionTone('found')).toBe('ok')
    expect(catalogActionLabel('installed')).toBe('Installed')
    expect(catalogActionTone('installed')).toBe('quiet')
    expect(catalogActionLabel('connected')).toBe('Connected')
    expect(catalogActionTone('connected')).toBe('quiet')
    expect(catalogActionLabel('missing')).toBe('Install')
    expect(catalogActionTone('missing')).toBe('secondary')
    expect(catalogActionLabel('off')).toBe('Connect')
    expect(catalogActionTone('off')).toBe('secondary')
  })

  it('colors a Your apps badge green only for found and connected rows', () => {
    expect(catalogBadgeTone('found')).toBe('ok')
    expect(catalogBadgeTone('connected')).toBe('ok')
    expect(catalogBadgeTone('installed')).toBe('plain')
    expect(catalogBadgeTone('missing')).toBe('plain')
  })

  it('accepts only the four marketplace agent ids', () => {
    expect(isCatalogAgentId('gentle-shell')).toBe(true)
    expect(isCatalogAgentId('pi')).toBe(false)
    expect(isCatalogAgentId(undefined)).toBe(false)
  })
})
