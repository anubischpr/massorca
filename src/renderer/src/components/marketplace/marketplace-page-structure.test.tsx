// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
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
const { MarketplaceBoardToolPage } = await import('./MarketplaceBoardToolPage')
const { MarketplaceCustomItemPage, MarketplaceCustomUnavailablePage } =
  await import('./MarketplaceCustomItemPage')
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

/** Gives the page this computer's service bridge, which answers with the status given. */
function bridgeServicesAs(status: ReturnType<typeof serviceStatus>): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      ...window.api,
      marketplaceServices: { status: vi.fn(async () => status) }
    }
  })
}

/** The service status this computer reports: GitLab saved or not; the others unset. */
function serviceStatus(gitlabSource: 'none' | 'stored') {
  return {
    ok: true,
    status: {
      hostLabel: 'This computer',
      store: 'key-file',
      services: [
        {
          service: 'gitlab',
          source: gitlabSource,
          cliInstalled: true,
          ...(gitlabSource === 'stored' ? { updatedAt: 1 } : {})
        },
        { service: 'bitbucket', source: 'none' },
        { service: 'azure-devops', source: 'none' },
        { service: 'gitea', source: 'none' }
      ]
    }
  }
}

const TOOL_ROW: CatalogRow = {
  key: 'board-gh',
  section: 'tools',
  name: 'GitHub CLI',
  description: 'Signs in to GitHub; agents open pull requests with it.',
  icon: { kind: 'skill' },
  status: { kind: 'pending', label: 'Install' },
  target: { kind: 'board-tool', id: 'gh' },
  owned: false,
  service: false,
  customId: null
}

const NODE_ROW: CatalogRow = {
  ...TOOL_ROW,
  key: 'board-node',
  name: 'Node.js',
  description: 'Runs the JavaScript tools some agents call.',
  target: { kind: 'board-tool', id: 'node' }
}

const UNAVAILABLE_ROW: CatalogRow = {
  ...TOOL_ROW,
  key: 'custom-unavailable-tools',
  name: 'Custom tools',
  description: '',
  status: { kind: 'pending', label: 'Not available on This computer yet' },
  target: { kind: 'custom-unavailable', itemKind: 'tool' }
}

const CUSTOM_TOOL: MarketplaceCustomItemStatus = {
  id: 'custom-tool-1',
  kind: 'tool',
  name: 'Ripgrep helper',
  checkCommand: ['rg', '--version'],
  install: { darwin: ['brew', 'install', 'ripgrep'] },
  createdAt: 1,
  presence: 'missing'
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

/** Whether a leaf element outside a why line reads exactly this text. */
function hasLeafText(page: HTMLElement, text: string): boolean {
  return [...page.querySelectorAll('*')].some(
    (el) =>
      el.childElementCount === 0 &&
      el.textContent?.trim() === text &&
      el.closest('[data-marketplace-note]') === null
  )
}

function isInstallText(text: string): boolean {
  return (
    text === 'Install' ||
    text === 'Connect' ||
    text === 'Add workspace access' ||
    text === 'Add Jira site' ||
    text.startsWith('Install on ')
  )
}

/**
 * The page's structure as the DOM shows it. Markers: the host picker is the dropdown trigger;
 * install and uninstall are the action buttons; sections are data-marketplace-section ids, each
 * present with its content or with a why line; the banner is its "Copy this prompt" arrows or its
 * why line; accessPolicy is the agent, skill-agent or bot-team control, or the access card.
 */
function observe(page: HTMLElement): MarketplacePageStructure {
  const section = (id: string): boolean =>
    page.querySelector(`[data-marketplace-section="${id}"]`) !== null
  return {
    hostPicker: page.querySelector('button[aria-haspopup="menu"]') !== null,
    install: hasAction(page, isInstallText),
    uninstall: hasAction(page, (text) => text === 'Disconnect' || text.startsWith('Remove from ')),
    connectionConfig: page.querySelector('[data-marketplace-section="connection"] button') !== null,
    accessPolicy:
      page.querySelector(
        '[data-marketplace-agent-settings], [data-marketplace-skill-agents], [data-marketplace-skill-teams]'
      ) !== null || hasLeafText(page, 'Who can use it'),
    sections: {
      banner:
        page.querySelector(
          'button[aria-label="Copy this prompt"], [data-marketplace-note="banner"]'
        ) !== null,
      connection: section('connection'),
      advanced: section('advanced'),
      danger: section('danger')
    }
  }
}

/** The functions a page lacks that have no why line: a silent omission, which must be empty. */
function missingWithoutNote(page: HTMLElement, structure: MarketplacePageStructure): string[] {
  const parts = new Set(
    [...page.querySelectorAll('[data-marketplace-note]')].map((el) =>
      el.getAttribute('data-marketplace-note')
    )
  )
  const functions: [string, boolean][] = [
    ['install', structure.install],
    ['uninstall', structure.uninstall],
    ['access', structure.accessPolicy],
    ['connection', structure.connectionConfig]
  ]
  return functions.filter(([part, present]) => !present && !parts.has(part)).map(([part]) => part)
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
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE.agent)).toEqual([])
  })

  it('built-in: picker, every section with a why line, no install or uninstall', async () => {
    const page = await render(
      <MarketplaceSkillBuiltInPage
        command={BUILT_IN_SKILL_COMMANDS.prototype}
        onBack={() => undefined}
      />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['built-in'])
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE['built-in'])).toEqual([])
  })

  it('skill not installed: Install on this computer, the Danger zone says why', async () => {
    const page = await render(<MarketplaceSkillPage skill={POOL_SKILL} onBack={() => undefined} />)
    const expected = { ...MARKETPLACE_PAGE_STRUCTURE.skill, uninstall: false }
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
  })

  it('skill installed with a copy: Remove from this computer and the Danger zone, no Install', async () => {
    const page = await render(
      <MarketplaceSkillPage
        skill={INSTALLED_SKILL}
        copies={[CLAUDE_COPY]}
        onBack={() => undefined}
      />
    )
    const expected = { ...MARKETPLACE_PAGE_STRUCTURE.skill, install: false }
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
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
    const expected = MARKETPLACE_PAGE_STRUCTURE['integration:linear']
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
  })

  it('integration: a connected Jira shows its site access, Advanced options and Danger zone', async () => {
    seedStore(store, {
      jiraStatus: {
        connected: true,
        viewer: null,
        sites: [
          {
            id: 'site-1',
            displayName: 'Acme',
            siteUrl: 'https://acme.atlassian.net',
            email: 'ana@example.com',
            accountId: 'acc-1'
          }
        ]
      },
      jiraStatusChecked: true,
      jiraStatusContextKey: getProviderRuntimeContextKey(settings),
      disconnectJira: vi.fn(async () => undefined)
    })
    const page = await render(
      <MarketplaceIntegrationPage integration="jira" onBack={() => undefined} />
    )
    const expected = MARKETPLACE_PAGE_STRUCTURE['integration:jira']
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
  })

  it.each(['gitlab', 'bitbucket', 'azure-devops', 'gitea'] as const)(
    'integration %s with no token: Connect, Advanced options with the access why, Danger says why',
    async (service) => {
      bridgeServicesAs(serviceStatus('none'))
      const page = await render(
        <MarketplaceIntegrationPage integration={service} onBack={() => undefined} />
      )
      await act(async () => {
        await Promise.resolve()
      })
      const expected = {
        ...MARKETPLACE_PAGE_STRUCTURE[`integration:${service}` as const],
        uninstall: false
      }
      expect(observe(page)).toEqual(expected)
      expect(missingWithoutNote(page, expected)).toEqual([])
    }
  )

  it('integration gitlab with a saved token: Disconnect in the Danger zone, Replace in Connection', async () => {
    bridgeServicesAs(serviceStatus('stored'))
    const page = await render(
      <MarketplaceIntegrationPage integration="gitlab" onBack={() => undefined} />
    )
    await act(async () => {
      await Promise.resolve()
    })
    const expected = { ...MARKETPLACE_PAGE_STRUCTURE['integration:gitlab'], install: false }
    // Why: a saved token replaces Connect with Replace in the Connection section.
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
  })

  it('item-app: Connect while an agent entry is missing, Disconnect, Who can use it', async () => {
    const page = await render(<MarketplaceAppPage appId="openmetadata" onBack={() => undefined} />)
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['item-app'])
  })

  it('item-detail (Git): Install board while Git is missing, every section with a why line', async () => {
    const git = MARKETPLACE_CATALOG.find((item) => item.id === 'git')
    if (!git) {
      throw new Error('Git item missing from the catalog')
    }
    const page = await render(
      <MarketplaceDetail item={git} badgeState="not-installed" onBack={() => undefined} />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['item-detail'])
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE['item-detail'])).toEqual([])
  })

  it('board tool GitHub CLI: picker, a disabled install with its why, every section', async () => {
    const page = await render(<MarketplaceBoardToolPage row={TOOL_ROW} onBack={() => undefined} />)
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['board-tool'])
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE['board-tool'])).toEqual([])
    expect(page.textContent).toContain('MassOrca cannot install GitHub CLI yet.')
  })

  it('board tool Node.js: the same structure, with Node.js wording', async () => {
    const page = await render(<MarketplaceBoardToolPage row={NODE_ROW} onBack={() => undefined} />)
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['board-tool'])
    expect(page.textContent).toContain('MassOrca cannot install Node.js yet.')
    expect(page.textContent).toContain('Node.js needs no account.')
  })

  it('custom tool not installed here: Install, the commands, Remove from Marketplace', async () => {
    const page = await render(
      <MarketplaceCustomItemPage item={CUSTOM_TOOL} onBack={() => undefined} />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['custom-item'])
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE['custom-item'])).toEqual([])
    expect(page.textContent).toContain('brew install ripgrep')
  })

  it('custom tool already found here: no Install, and its install line says why', async () => {
    const page = await render(
      <MarketplaceCustomItemPage
        item={{ ...CUSTOM_TOOL, presence: 'found' }}
        onBack={() => undefined}
      />
    )
    const expected = { ...MARKETPLACE_PAGE_STRUCTURE['custom-item'], install: false }
    expect(observe(page)).toEqual(expected)
    expect(missingWithoutNote(page, expected)).toEqual([])
  })

  it('custom tools on a picked host: every function says why, the picker stays', async () => {
    const page = await render(
      <MarketplaceCustomUnavailablePage row={UNAVAILABLE_ROW} onBack={() => undefined} />
    )
    expect(observe(page)).toEqual(MARKETPLACE_PAGE_STRUCTURE['custom-unavailable'])
    expect(missingWithoutNote(page, MARKETPLACE_PAGE_STRUCTURE['custom-unavailable'])).toEqual([])
  })
})

describe('marketplaceRowSource', () => {
  it('maps Git and Node.js to native, GitHub CLI and service rows to external', () => {
    expect(
      marketplaceRowSource({
        ...TOOL_ROW,
        key: 'item-git',
        target: { kind: 'item', id: 'git' }
      })
    ).toEqual({ source: 'native' })
    expect(marketplaceRowSource(NODE_ROW)).toEqual({ source: 'native' })
    expect(marketplaceRowSource(TOOL_ROW)).toEqual({
      source: 'external',
      externalDependencies: ['GitHub CLI signed in with gh auth login']
    })
    expect(
      marketplaceRowSource({
        ...TOOL_ROW,
        key: 'integration-linear',
        target: { kind: 'integration', id: 'linear' }
      }).source
    ).toBe('external')
  })
})
