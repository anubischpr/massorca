// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { CatalogCheck } from './MarketplaceCatalogRows'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceSkillPageSkill } from './MarketplaceSkillPageModel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Mocks = {
  teams: BotTeam[]
  detected: string[] | null
  targets: MarketplaceVaultHostTarget[]
  remoteAgents: CatalogCheck<ReadonlySet<string>>
  preview: Mock<(...args: unknown[]) => unknown>
  remove: Mock<(...args: unknown[]) => unknown>
  confirm: Mock<(...args: unknown[]) => unknown>
}

const mocks = vi.hoisted((): Mocks => ({
  teams: [],
  detected: ['claude', 'codex', 'pi'],
  targets: [],
  remoteAgents: { kind: 'ready', value: new Set(['codex']) },
  preview: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn()
}))

vi.mock('@/runtime/runtime-skills-client', () => ({
  runtimeTargetSupportsSkillDelete: () => Promise.resolve(true),
  previewSkillDeletionOnRuntimeTarget: (...args: unknown[]) => mocks.preview(...args),
  deleteSkillsOnRuntimeTarget: (...args: unknown[]) => mocks.remove(...args)
}))
vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => mocks.confirm
}))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams: () => Promise.resolve(mocks.teams)
}))
vi.mock('../skills/use-skill-install-detected-agents', () => ({
  useSkillInstallDetectedAgents: () => mocks.detected
}))
vi.mock('../skills/SkillInstallDialog', () => ({
  SkillInstallDialog: ({
    initialLink,
    initialTarget
  }: {
    initialLink?: string
    initialTarget?: unknown
  }) => (
    <div
      data-install-dialog={initialLink ?? ''}
      data-install-target={JSON.stringify(initialTarget ?? null)}
    />
  )
}))
vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => mocks.targets
}))
vi.mock('./use-marketplace-remote-detection', () => ({
  useMarketplaceRemoteDetection: () => ({ agents: mocks.remoteAgents })
}))
vi.mock('./marketplace-apps-host-client', () => ({
  readHostApps: () => Promise.resolve({ ok: true, apps: [] }),
  createHostMarketplaceAppsApi: () => ({})
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceSkillPage } = await import('./MarketplaceSkillPage')

function bot(id: string, name: string, skills: string[]): BotTeamBot {
  return {
    id,
    name,
    job: '',
    agent: 'claude',
    modelMode: 'auto',
    model: null,
    effort: null,
    skills
  }
}

function team(id: string, name: string, bots: BotTeamBot[]): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots
  }
}

const POOL_SKILL: MarketplaceSkillPageSkill = {
  name: 'Browser use',
  description: 'Lets agents open and use pages in the browser pane.',
  installed: false,
  agentIds: ['shared'],
  installLink: 'https://app.orca.dev/skills/share/abc',
  folders: [],
  origin: {
    kind: 'pool',
    name: 'MassOrca skills pool',
    detail: 'Bundled with this version of MassOrca.'
  }
}

const VPS: MarketplaceVaultHostTarget = { kind: 'runtime', environmentId: 'env-1', label: 'VPS' }

let root: Root | null = null
let container: HTMLDivElement | null = null

async function renderPage(
  skill: MarketplaceSkillPageSkill = POOL_SKILL,
  onBack = vi.fn()
): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <MarketplaceSkillPage skill={skill} onBack={onBack} />
      </TooltipProvider>
    )
  })
  await act(async () => {})
  return container
}

function section(name: string): HTMLElement {
  const found = container?.querySelector<HTMLElement>(`[data-marketplace-skill-${name}]`)
  if (!found) {
    throw new Error(`Missing section ${name}`)
  }
  return found
}

function buttonIn(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Missing button ${text}`)
  }
  return button
}

function pressedLabels(scope: ParentNode): string[] {
  return [...scope.querySelectorAll('button[aria-pressed="true"]')].map(
    (button) => button.textContent ?? ''
  )
}

function hostTrigger(scope: ParentNode): HTMLButtonElement | null {
  return scope.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
}

/** Opens the host dropdown the Marketplace home uses and clicks the host whose name contains label. */
async function pickHost(scope: ParentNode, label: string): Promise<void> {
  const trigger = hostTrigger(scope)
  if (!trigger) {
    throw new Error('Host list missing')
  }
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  })
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((candidate) =>
    candidate.textContent?.includes(label)
  )
  if (!item) {
    throw new Error(`Host missing: ${label}`)
  }
  await act(async () => {
    item.click()
  })
}

beforeEach(() => {
  mocks.detected = ['claude', 'codex', 'pi']
  mocks.teams = [
    team('mk', 'Marketing', [bot('b1', 'Iris', ['Browser use']), bot('b2', 'Ana', [])]),
    team('dev', 'Development', [bot('b3', 'Max', []), bot('b4', 'Leo', [])])
  ]
  mocks.targets = [VPS]
  seedStore(store, { marketplaceHostKey: null })
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
})

describe('MarketplaceSkillPage', () => {
  it('shows the breadcrumb and returns to the catalog from Marketplace', async () => {
    const onBack = vi.fn()
    const page = await renderPage(POOL_SKILL, onBack)
    const crumb = page.querySelector('nav')
    expect(crumb?.textContent).toBe('MarketplaceBrowser use')
    await act(async () => crumb?.querySelector('button')?.click())
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('puts the host dropdown next to Back, and saves the host picked from it', async () => {
    const page = await renderPage()
    const backRow = page.querySelector('nav')?.parentElement ?? page
    expect(hostTrigger(backRow)?.textContent).toContain('This computer')
    await pickHost(page, 'VPS')
    expect(store.getState().marketplaceHostKey).toBe('runtime:env-1')
  })

  it('keeps the host dropdown when This computer is the only host', async () => {
    mocks.targets = []
    const page = await renderPage()
    expect(hostTrigger(page)).not.toBeNull()
  })

  it('heads a skill that is not installed and opens the install flow on its link', async () => {
    const page = await renderPage()
    expect(page.querySelector('h2')?.textContent).toBe('Browser use')
    expect(page.textContent).toContain('Lets agents open and use pages in the browser pane.')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Not installed on This computer'
    )
    expect(page.querySelector('[data-install-dialog]')).toBeNull()
    await act(async () => buttonIn(page, 'Install on This computer').click())
    expect(page.querySelector('[data-install-dialog]')?.getAttribute('data-install-dialog')).toBe(
      'https://app.orca.dev/skills/share/abc'
    )
  })

  it('drops the install button once the skill is installed', async () => {
    const page = await renderPage({ ...POOL_SKILL, installed: true })
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on This computer'
    )
    expect(page.textContent).not.toContain('Install on This computer')
  })

  it('lists only the agents on this computer that can take a skill, pressed when they read it', async () => {
    await renderPage()
    const agents = section('agents')
    expect(agents.querySelector('h3')?.textContent).toBe('Workspaces')
    expect(agents.textContent).toContain('Agents that get it')
    expect(agents.textContent).toContain(
      'Only agents installed on This computer are listed. Each one keeps its own copy.'
    )
    expect([...agents.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Codex',
      'Claude Code'
    ])
    expect(pressedLabels(agents)).toEqual(['Codex'])
    await act(async () => buttonIn(agents, 'Claude Code').click())
    expect(pressedLabels(agents)).toEqual(['Codex', 'Claude Code'])
  })

  it('lists the bot teams with their bot counts and picks the ones already using it', async () => {
    await renderPage()
    const teams = section('teams')
    expect(teams.querySelector('h3')?.textContent).toBe('Bot teams')
    expect(teams.textContent).toContain('Teams that can use it')
    expect(teams.textContent).toContain(
      'Bots in these teams see it in their profile, under Skills.'
    )
    expect(pressedLabels(teams)).toEqual(['Marketing2'])
    expect(teams.textContent).toContain('Used by 1 bot')
    expect(teams.textContent).toContain('Change one bot from its profile.')
  })

  it('counts every bot of the picked teams when it is on for all of them', async () => {
    await renderPage()
    const teams = section('teams')
    expect(teams.textContent).toContain('Turn it on for every bot in these teams')
    expect(teams.textContent).toContain('Off: each bot chooses it in its own profile.')
    await act(async () => buttonIn(teams, 'Development2').click())
    await act(async () => buttonIn(teams, 'On').click())
    expect(teams.textContent).toContain('Used by 4 bots')
  })

  it('shows which bots use it, filtered by Find a bot, and hides them again', async () => {
    await renderPage()
    const teams = section('teams')
    await act(async () => buttonIn(teams, 'See which').click())
    expect(teams.textContent).toContain('Iris · Marketing')
    const search = teams.querySelector<HTMLInputElement>('input[aria-label="Find a bot"]')
    expect(search?.placeholder).toBe('Find a bot')
    await act(async () => buttonIn(teams, 'Hide').click())
    expect(teams.textContent).not.toContain('Iris · Marketing')
  })

  it('says where the skill comes from', async () => {
    await renderPage()
    const origin = section('origin')
    expect(origin.textContent).toContain('Where it comes from')
    expect(origin.textContent).toContain('MassOrca skills pool')
    expect(origin.textContent).toContain('Bundled with this version of MassOrca.')
  })
})

describe('MarketplaceSkillPage with a remote host picked', () => {
  const UBUNTU: MarketplaceVaultHostTarget = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }

  afterEach(() => {
    mocks.targets = [VPS]
    mocks.remoteAgents = { kind: 'ready', value: new Set(['codex']) }
    Reflect.deleteProperty(window, 'api')
  })

  async function renderOn(
    hostKey: string,
    hostName: string,
    skill: MarketplaceSkillPageSkill,
    onRescan?: () => void
  ): Promise<HTMLDivElement> {
    seedStore(store, { marketplaceHostKey: hostKey })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <TooltipProvider>
          <MarketplaceSkillPage
            skill={skill}
            hostName={hostName}
            onBack={vi.fn()}
            onRescan={onRescan}
          />
        </TooltipProvider>
      )
    })
    await act(async () => {})
    return container
  }

  function startingTarget(page: ParentNode): unknown {
    const raw = page.querySelector('[data-install-target]')?.getAttribute('data-install-target')
    return raw ? JSON.parse(raw) : null
  }

  it('reads the install state and the agents of the picked runtime host, never this computer', async () => {
    const page = await renderOn('runtime:env-1', 'VPS', POOL_SKILL)
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Not installed on VPS'
    )
    expect(page.textContent).not.toContain('Install on This computer')
    expect(page.textContent).not.toContain('is not available yet')
    const agents = section('agents')
    expect(agents.textContent).toContain('Only agents installed on VPS are listed.')
    expect([...agents.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Codex'
    ])
  })

  it('opens the install dialog on the picked runtime host with the agents its switches show', async () => {
    const page = await renderOn('runtime:env-1', 'VPS', POOL_SKILL)
    await act(async () => buttonIn(page, 'Install on VPS').click())
    expect(startingTarget(page)).toEqual({ environmentId: 'env-1', providers: ['codex'] })
  })

  it('says the agents of a picked host could not be checked, and lists none', async () => {
    mocks.remoteAgents = { kind: 'failed' }
    const page = await renderOn('runtime:env-1', 'VPS', POOL_SKILL)
    expect(section('agents').textContent).toContain('Could not check VPS')
    expect(section('agents').querySelectorAll('button')).toHaveLength(0)
    expect(buttonIn(page, 'Install on VPS')).toBeTruthy()
  })

  it('shows the installed state the WSL distro reports and lists the agents it has', async () => {
    mocks.targets = [UBUNTU]
    const page = await renderOn('wsl:Ubuntu', 'WSL: Ubuntu', { ...POOL_SKILL, installed: true })
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on WSL: Ubuntu'
    )
    expect(page.textContent).not.toContain('Could not check WSL: Ubuntu')
    expect([...section('agents').querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Codex'
    ])
  })

  it('opens the install dialog on the picked WSL distro, through its execution target', async () => {
    mocks.targets = [UBUNTU]
    const page = await renderOn('wsl:Ubuntu', 'WSL: Ubuntu', POOL_SKILL)
    await act(async () => buttonIn(page, 'Install on WSL: Ubuntu').click())
    expect(startingTarget(page)).toEqual({
      environmentId: 'local',
      executionTarget: { kind: 'wsl', distro: 'Ubuntu' },
      providers: ['codex']
    })
  })

  it('starts the next install with the switches the person changed', async () => {
    mocks.remoteAgents = { kind: 'ready', value: new Set(['codex', 'claude']) }
    const page = await renderOn('runtime:env-1', 'VPS', POOL_SKILL)
    await act(async () => buttonIn(section('agents'), 'Claude Code').click())
    await act(async () => buttonIn(page, 'Install on VPS').click())
    expect(startingTarget(page)).toEqual({
      environmentId: 'env-1',
      providers: ['codex', 'claude']
    })
  })

  it('places a copy already on the picked host for the agents the switches now show', async () => {
    mocks.remoteAgents = { kind: 'ready', value: new Set(['codex', 'claude']) }
    const installPackageVersion = vi.fn().mockResolvedValue({
      status: 'ok',
      value: { operationId: 'op', status: 'installed', name: 'browser-use', placements: [] }
    })
    const listManagedInstalls = vi.fn().mockResolvedValue({
      status: 'ok',
      value: [
        {
          name: 'browser-use',
          packageId: 'pkg-1',
          versionId: 'v1',
          packageDigest: 'a'.repeat(64),
          scope: 'global',
          destinationIdentity: 'global:env-1',
          destination: { scope: 'global' },
          installedAt: '2026-11-01T00:00:00.000Z',
          state: 'unchanged'
        }
      ]
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: { installPackageVersion, listManagedInstalls } }
    })
    const page = await renderOn('runtime:env-1', 'VPS', {
      ...POOL_SKILL,
      installed: true,
      folders: ['browser-use'],
      agentIds: ['codex']
    })
    await act(async () => buttonIn(section('agents'), 'Claude Code').click())
    expect(listManagedInstalls).toHaveBeenCalledWith('env-1')
    expect(installPackageVersion).toHaveBeenCalledWith({
      packageId: 'pkg-1',
      versionId: 'v1',
      environmentId: 'env-1',
      destination: { scope: 'global' },
      providers: expect.arrayContaining(['codex', 'claude'])
    })
    expect(page.querySelector('[data-install-dialog]')).toBeNull()
  })

  it('reads the picked host again when an install lands there', async () => {
    const onRescan = vi.fn()
    await renderOn('runtime:env-1', 'VPS', POOL_SKILL, onRescan)
    window.dispatchEvent(new Event(INSTALLED_AGENT_SKILLS_CHANGED_EVENT))
    expect(onRescan).toHaveBeenCalledTimes(1)
  })
})

describe('MarketplaceSkillPage for a skill already installed', () => {
  const UBUNTU: MarketplaceVaultHostTarget = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }
  const LOCAL_INSTALL = {
    name: 'browser-use',
    packageId: 'pkg-1',
    versionId: 'v1',
    packageDigest: 'a'.repeat(64),
    scope: 'global',
    destinationIdentity: 'global:local',
    destination: { scope: 'global' },
    installedAt: '2026-11-01T00:00:00.000Z',
    state: 'unchanged'
  }
  const INSTALLED: MarketplaceSkillPageSkill = {
    ...POOL_SKILL,
    installed: true,
    agentIds: ['codex'],
    folders: ['browser-use']
  }

  function copyOf(
    id: string,
    sourceLabel: string,
    root: string,
    installed = true
  ): DiscoveredSkill {
    return {
      id,
      name: 'browser-use',
      description: 'Opens pages.',
      providers: ['agent-skills'],
      sourceKind: 'home',
      sourceLabel,
      rootPath: root,
      directoryPath: `${root}/browser-use`,
      skillFilePath: `${root}/browser-use/SKILL.md`,
      installed,
      updatedAt: null
    }
  }

  const CLAUDE_COPY = copyOf('copy-claude', 'Claude home', '/home/dev/.claude/skills')
  const CODEX_COPY = copyOf('copy-codex', 'Codex home', '/home/dev/.codex/skills', false)

  function stubBridge(installs: unknown[]): {
    installPackageVersion: Mock
    listManagedInstalls: Mock
  } {
    const installPackageVersion = vi.fn().mockResolvedValue({
      status: 'ok',
      value: { operationId: 'op', status: 'installed', name: 'browser-use', placements: [] }
    })
    const listManagedInstalls = vi.fn().mockResolvedValue({ status: 'ok', value: installs })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: { installPackageVersion, listManagedInstalls } }
    })
    return { installPackageVersion, listManagedInstalls }
  }

  async function renderSkill(props: {
    skill?: MarketplaceSkillPageSkill
    copies?: DiscoveredSkill[]
    hostName?: string
    focusedRuntime?: { kind: 'local' } | null
    onBack?: () => void
    onRescan?: () => void
  }): Promise<HTMLDivElement> {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <TooltipProvider>
          <MarketplaceSkillPage
            skill={props.skill ?? INSTALLED}
            copies={props.copies}
            hostName={props.hostName}
            focusedRuntime={props.focusedRuntime ?? null}
            onBack={props.onBack ?? vi.fn()}
            onRescan={props.onRescan}
          />
        </TooltipProvider>
      )
    })
    await act(async () => {})
    await act(async () => {})
    return container
  }

  beforeEach(() => {
    mocks.preview.mockReset()
    mocks.remove.mockReset()
    mocks.confirm.mockResolvedValue(true)
  })

  afterEach(() => {
    mocks.targets = [VPS]
    Reflect.deleteProperty(window, 'api')
  })

  it('lists every copy of the skill, each with the folder it sits in', async () => {
    await renderSkill({ copies: [CLAUDE_COPY, CODEX_COPY] })
    expect(section('copies').textContent).toContain('Claude home')
    expect(section('copies').textContent).toContain('/home/dev/.claude/skills/browser-use')
    expect(section('copies').textContent).toContain('/home/dev/.codex/skills/browser-use')
  })

  it('changes the agents of an installed skill through its Marketplace install', async () => {
    const bridge = stubBridge([LOCAL_INSTALL])
    await renderSkill({ copies: [CODEX_COPY] })
    await act(async () => buttonIn(section('agents'), 'Claude Code').click())
    expect(bridge.installPackageVersion).toHaveBeenCalledWith({
      packageId: 'pkg-1',
      versionId: 'v1',
      providers: expect.arrayContaining(['codex', 'claude']),
      destination: { scope: 'global' }
    })
    expect(pressedLabels(section('agents'))).toEqual(['Codex', 'Claude Code'])
  })

  it('locks the switches of an installed copy that MassOrca did not install, and says why', async () => {
    const bridge = stubBridge([])
    await renderSkill({ copies: [CLAUDE_COPY] })
    expect(section('agents').textContent).toContain(
      'MassOrca did not install this copy, so its agents cannot be changed here.'
    )
    expect(buttonIn(section('agents'), 'Claude Code').disabled).toBe(true)
    expect(buttonIn(section('agents'), 'Codex').disabled).toBe(true)
    expect(bridge.installPackageVersion).not.toHaveBeenCalled()
  })

  it('keeps the last agent that reads an installed skill switched on', async () => {
    stubBridge([LOCAL_INSTALL])
    await renderSkill({ copies: [CODEX_COPY] })
    expect(buttonIn(section('agents'), 'Codex').disabled).toBe(true)
    expect(buttonIn(section('agents'), 'Claude Code').disabled).toBe(false)
  })

  it('removes every copy from the Danger zone through the delete API, then rescans the list', async () => {
    mocks.preview.mockResolvedValue({
      operationId: 'op-1',
      skills: [
        {
          id: 'copy-claude',
          name: 'browser-use',
          canonicalPath: CLAUDE_COPY.skillFilePath,
          placements: []
        },
        {
          id: 'copy-codex',
          name: 'browser-use',
          canonicalPath: CODEX_COPY.skillFilePath,
          placements: []
        }
      ]
    })
    mocks.remove.mockResolvedValue({
      operationId: 'op-1',
      skills: [
        { id: 'copy-claude', name: 'browser-use', status: 'deleted', removedPaths: [] },
        { id: 'copy-codex', name: 'browser-use', status: 'deleted', removedPaths: [] }
      ]
    })
    const onBack = vi.fn()
    const onRescan = vi.fn()
    const page = await renderSkill({
      copies: [CLAUDE_COPY, CODEX_COPY],
      focusedRuntime: { kind: 'local' },
      onBack,
      onRescan
    })
    expect(page.textContent).toContain('Danger zone')
    await act(async () => buttonIn(page, 'Remove from This computer').click())
    await act(async () => {})
    expect(mocks.remove).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({
        skills: [
          expect.objectContaining({ id: 'copy-claude' }),
          expect.objectContaining({ id: 'copy-codex' })
        ]
      })
    )
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onRescan).toHaveBeenCalled()
  })

  it('keeps Remove unavailable on a WSL distro, and says why', async () => {
    mocks.targets = [UBUNTU]
    seedStore(store, { marketplaceHostKey: 'wsl:Ubuntu' })
    const page = await renderSkill({
      copies: [CLAUDE_COPY],
      hostName: 'WSL: Ubuntu',
      focusedRuntime: { kind: 'local' }
    })
    expect(page.textContent).toContain('Removing skills on WSL is not available yet.')
    expect(page.textContent).not.toContain('Remove from WSL: Ubuntu')
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('offers no Remove for a skill that is not installed', async () => {
    const page = await renderSkill({ skill: POOL_SKILL })
    expect(page.textContent).not.toContain('Danger zone')
  })
})
