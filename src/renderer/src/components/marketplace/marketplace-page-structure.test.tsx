// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import type { GitInstallPlanView } from '../../../../shared/marketplace-install'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { MARKETPLACE_CATALOG } from './marketplace-catalog'
import {
  MARKETPLACE_PAGE_STRUCTURE,
  marketplaceRowSource,
  type MarketplacePageStructure
} from './marketplace-page-structure'
import { BUILT_IN_SKILL_COMMANDS } from './marketplace-skill-built-in'
import type { CatalogRow } from './MarketplaceCatalogRows'
import type { MarketplaceSkillPageSkill } from './MarketplaceSkillPageModel'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Why: the target and team lists must be the same array on every render, or the app host reloads forever.
const NO_TARGETS: MarketplaceVaultHostTarget[] = []
const NO_TEAMS: BotTeam[] = []
const GIT_PLAN: GitInstallPlanView = {
  manager: 'homebrew',
  command: 'brew install git',
  manualCommand: 'brew install git',
  steps: [{ id: 'install', label: 'Install Git with Homebrew', elevation: 'none' }]
}

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/local-preflight-context', () => ({
  getLocalPreflightContext: () => ({}),
  localPreflightContextKey: () => 'local'
}))
vi.mock('@/lib/agent-catalog', () => {
  const entries = [
    {
      id: 'claude',
      label: 'Claude Code',
      cmd: 'claude',
      homepageUrl: 'https://example.test/claude'
    }
  ]
  const labelFor = (agent: string): string =>
    entries.find((entry) => entry.id === agent)?.label ?? agent
  return {
    AgentIcon: () => null,
    getAgentCatalog: () => entries,
    getAgentLabel: labelFor,
    getAgentDisplayLabel: labelFor
  }
})
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'unknown' }))
// Why: this computer has no claude, so the agent page offers Install.
vi.mock('@/hooks/useDetectedAgents', () => ({
  useDetectedAgents: () => ({
    detectedIds: [],
    isLoading: false,
    detectionFailed: false,
    isRefreshing: false,
    refresh: () => undefined
  })
}))
vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => NO_TARGETS
}))
vi.mock('./marketplace-host-wsl', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceWslTargets: () => NO_TARGETS
}))
vi.mock('./marketplace-apps-host-client', () => ({
  readHostApps: () => Promise.resolve({ ok: true, apps: [] }),
  createHostMarketplaceAppsApi: () => ({})
}))
vi.mock('@/components/bot-teams/use-bot-teams', () => ({
  useBotTeams: () => ({
    teams: NO_TEAMS,
    failed: false,
    lastSeenAt: null,
    reload: () => undefined,
    applyChange: async () => true
  })
}))
// Why: the real refresh would overwrite the Settings states these tests seed.
vi.mock('../settings/use-integration-provider-status-refresh', () => ({
  useIntegrationProviderStatusRefresh: () => undefined
}))
vi.mock('../settings/linear-agent-skill-install-cta', () => ({
  LinearAgentSkillInstallCta: () => null
}))
vi.mock('./GitInstallController', () => ({
  useGitInstallController: () => ({
    view: { kind: 'before', plan: GIT_PLAN },
    install: () => undefined,
    adopt: () => undefined,
    recheck: () => undefined
  })
}))
vi.mock('@/runtime/runtime-skills-client', () => ({
  runtimeTargetSupportsSkillDelete: () => Promise.resolve(true),
  previewSkillDeletionOnRuntimeTarget: () => Promise.resolve(null),
  deleteSkillsOnRuntimeTarget: () => Promise.resolve(null)
}))
vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams: () => Promise.resolve([])
}))
vi.mock('../skills/use-skill-install-detected-agents', () => ({
  useSkillInstallDetectedAgents: () => ['claude']
}))
vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => vi.fn()
}))
vi.mock('./use-marketplace-remote-detection', () => ({
  useMarketplaceRemoteDetection: () => ({ agents: { kind: 'ready', value: new Set<string>() } })
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAgentPage } = await import('./MarketplaceAgentPage')
const { MarketplaceSkillBuiltInPage } = await import('./MarketplaceSkillBuiltInPage')
const { MarketplaceSkillPage } = await import('./MarketplaceSkillPage')
const { MarketplaceIntegrationPage } = await import('./MarketplaceIntegrationPage')
const { MarketplaceAppPage } = await import('./MarketplaceAppPage')
const { MarketplaceDetail } = await import('./MarketplaceDetail')
const { getProviderRuntimeContextKey } = await import('@/lib/provider-runtime-context')

const settings = getDefaultSettings('/tmp')

// Why: antigravity is installed with no entry yet, so the app page's Connect fills it in.
const OPEN_METADATA: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: true,
  serverUrl: 'https://metadata.example.com',
  credential: { stored: true },
  profiles: [{ name: 'prod', url: 'https://prod.example.com', hasToken: true }],
  agents: [
    { agent: 'claude', level: 'full', entry: 'set', installed: true },
    { agent: 'codex', level: 'full', entry: 'set', installed: true },
    { agent: 'antigravity', level: 'tools-only', entry: 'missing', installed: true }
  ]
}

const POOL_SKILL: MarketplaceSkillPageSkill = {
  name: 'browser-use',
  description: 'Opens pages.',
  installed: false,
  agentIds: ['shared'],
  installLink: '',
  folders: [],
  origin: { kind: 'pool', name: 'MassOrca skills pool', detail: 'Bundled with this version.' }
}
const INSTALLED_SKILL: MarketplaceSkillPageSkill = {
  ...POOL_SKILL,
  installed: true,
  agentIds: ['claude'],
  folders: ['browser-use']
}
const CLAUDE_COPY: DiscoveredSkill = {
  id: 'copy-claude',
  name: 'browser-use',
  description: 'Opens pages.',
  providers: ['agent-skills'],
  sourceKind: 'home',
  sourceLabel: 'Claude home',
  rootPath: '/home/dev/.claude/skills',
  directoryPath: '/home/dev/.claude/skills/browser-use',
  skillFilePath: '/home/dev/.claude/skills/browser-use/SKILL.md',
  installed: true,
  updatedAt: null
}

const roots: { container: HTMLDivElement; root: Root }[] = []

async function render(element: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(<TooltipProvider>{element}</TooltipProvider>)
  })
  await act(async () => {})
  return container
}

/** Whether a button or link in the page has text this predicate accepts. */
function hasAction(page: HTMLElement, matches: (text: string) => boolean): boolean {
  return [...page.querySelectorAll('button, a')].some((el) => matches(el.textContent?.trim() ?? ''))
}

/** Whether a leaf element in the page reads exactly this text. */
function hasLeafText(page: HTMLElement, text: string): boolean {
  return [...page.querySelectorAll('*')].some(
    (el) => el.childElementCount === 0 && el.textContent?.trim() === text
  )
}

/**
 * The page's structure as the DOM shows it. Markers: the host picker is the dropdown trigger;
 * install and uninstall are the action buttons; sections are data-marketplace-section ids; the
 * banner is its "Copy this prompt" arrows; accessPolicy is the agent, skill-agent or bot-team control.
 */
function observe(page: HTMLElement): MarketplacePageStructure {
  const section = (id: string): boolean =>
    page.querySelector(`[data-marketplace-section="${id}"]`) !== null
  return {
    hostPicker: page.querySelector('button[aria-haspopup="menu"]') !== null,
    install: hasAction(
      page,
      (text) =>
        text === 'Install' ||
        text === 'Connect' ||
        text === 'Add workspace access' ||
        text.startsWith('Install on ')
    ),
    uninstall: hasAction(page, (text) => text === 'Disconnect' || text.startsWith('Remove from ')),
    connectionConfig: page.querySelector('[data-marketplace-section="connection"] button') !== null,
    accessPolicy:
      page.querySelector(
        '[data-marketplace-agent-settings], [data-marketplace-skill-agents], [data-marketplace-skill-teams]'
      ) !== null || hasLeafText(page, 'Who can use it'),
    sections: {
      banner: page.querySelector('button[aria-label="Copy this prompt"]') !== null,
      connection: section('connection'),
      advanced: section('advanced'),
      danger: section('danger')
    }
  }
}

beforeEach(() => {
  seedStore(store, {
    settings,
    updateSettings: vi.fn(),
    marketplaceHostKey: null,
    marketplaceApps: { status: 'ready', apps: [OPEN_METADATA] },
    preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: true } },
    preflightStatusChecked: true,
    preflightStatusContextKey: 'local'
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      skills: {
        installPackageVersion: () => Promise.resolve({ status: 'ok', value: null }),
        listManagedInstalls: () => Promise.resolve({ status: 'ok', value: [] })
      }
    }
  })
})

afterEach(async () => {
  for (const { container, root } of roots.splice(0)) {
    await act(async () => root.unmount())
    container.remove()
  }
  document.body.replaceChildren()
})

describe('Marketplace page structure matches the rendered pages', () => {
  it('agent: picker, Install for a host without the agent, Use this agent, no uninstall', async () => {
    const page = await render(<MarketplaceAgentPage agentId="claude" onBack={() => undefined} />)
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE.agent)
  })

  it('built-in: no picker, no install, no sections', async () => {
    const page = await render(
      <MarketplaceSkillBuiltInPage
        command={BUILT_IN_SKILL_COMMANDS.prototype}
        onBack={() => undefined}
      />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['built-in'])
  })

  it('skill not installed: Install on this computer, no Danger zone', async () => {
    const page = await render(<MarketplaceSkillPage skill={POOL_SKILL} onBack={() => undefined} />)
    expect(observe(page)).toEqual({
      ...MARKETPLACE_PAGE_STRUCTURE.skill,
      uninstall: false,
      sections: { ...MARKETPLACE_PAGE_STRUCTURE.skill.sections, danger: false }
    })
  })

  it('skill installed with a copy: Remove from this computer and the Danger zone, no Install', async () => {
    const page = await render(
      <MarketplaceSkillPage
        skill={INSTALLED_SKILL}
        copies={[CLAUDE_COPY]}
        onBack={() => undefined}
      />
    )
    expect(observe(page)).toEqual({ ...MARKETPLACE_PAGE_STRUCTURE.skill, install: false })
  })

  it('integration: a connected Linear shows every flag and section', async () => {
    seedStore(store, {
      linearStatus: {
        connected: true,
        viewer: null,
        workspaces: [
          {
            id: 'ws-1',
            organizationId: 'org-1',
            organizationName: 'Acme',
            displayName: 'Ana',
            email: null
          }
        ]
      },
      linearStatusChecked: true,
      linearStatusContextKey: getProviderRuntimeContextKey(settings),
      disconnectLinear: vi.fn(async () => undefined)
    })
    const page = await render(
      <MarketplaceIntegrationPage integration="linear" onBack={() => undefined} />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE.integration)
  })

  it('item-app: Connect while an agent entry is missing, Disconnect, Who can use it', async () => {
    const page = await render(<MarketplaceAppPage appId="openmetadata" onBack={() => undefined} />)
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['item-app'])
  })

  it('item-detail (Git): Install board while Git is missing, no sections', async () => {
    const git = MARKETPLACE_CATALOG.find((item) => item.id === 'git')
    if (!git) {
      throw new Error('Git item missing from the catalog')
    }
    const page = await render(
      <MarketplaceDetail item={git} badgeState="not-installed" onBack={() => undefined} />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['item-detail'])
  })
})

function rowOf(partial: Pick<CatalogRow, 'key' | 'section'> & Partial<CatalogRow>): CatalogRow {
  return {
    name: '',
    description: '',
    icon: { kind: 'skill' },
    status: { kind: 'done', label: '' },
    target: null,
    owned: false,
    service: false,
    customId: null,
    ...partial
  }
}

describe('marketplaceRowSource', () => {
  it('maps Git and placeholder rows to native, and service and CLI rows to external', () => {
    expect(
      marketplaceRowSource(
        rowOf({ key: 'item-git', section: 'tools', target: { kind: 'item', id: 'git' } })
      )
    ).toEqual({ source: 'native' })
    expect(marketplaceRowSource(rowOf({ key: 'board-node', section: 'tools' }))).toEqual({
      source: 'native'
    })
    expect(marketplaceRowSource(rowOf({ key: 'board-gh', section: 'tools' }))).toEqual({
      source: 'external',
      externalDependencies: ['GitHub CLI signed in with gh auth login']
    })
    expect(
      marketplaceRowSource(
        rowOf({
          key: 'integration-linear',
          section: 'services',
          target: { kind: 'integration', id: 'linear' }
        })
      ).source
    ).toBe('external')
  })
})
