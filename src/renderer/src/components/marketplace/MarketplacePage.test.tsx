// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { getDefaultSettings } from '../../../../shared/constants'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { requestSkillRowOpen } from './marketplace-skill-open-request'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(
  (): {
    detected: string[] | null
    discover: Mock<(...args: unknown[]) => unknown>
    custom: MarketplaceCustomItemStatus[]
    preview: Mock<(...args: unknown[]) => unknown>
    remove: Mock<(...args: unknown[]) => unknown>
    confirm: Mock<(...args: unknown[]) => unknown>
  } => ({
    detected: [],
    discover: vi.fn(),
    custom: [],
    preview: vi.fn(),
    remove: vi.fn(),
    confirm: vi.fn()
  })
)

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
    { id: 'claude', label: 'Claude Code' },
    { id: 'codex', label: 'Codex' }
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
vi.mock('@/hooks/useDetectedAgents', () => ({
  useDetectedAgents: () => ({
    detectedIds: mocks.detected,
    isLoading: false,
    detectionFailed: false,
    isRefreshing: false,
    refresh: vi.fn()
  })
}))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => ({ kind: 'local' })
}))
vi.mock('@/runtime/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: (...args: unknown[]) => mocks.discover(...args),
  runtimeTargetSupportsSkillDelete: () => Promise.resolve(true),
  previewSkillDeletionOnRuntimeTarget: (...args: unknown[]) => mocks.preview(...args),
  deleteSkillsOnRuntimeTarget: (...args: unknown[]) => mocks.remove(...args)
}))
vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => mocks.confirm
}))
vi.mock('./MarketplaceCatalogCustom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceCustomItems: () => ({
    items: mocks.custom,
    installingIds: new Set<string>(),
    install: vi.fn()
  })
}))
vi.mock('../skills/SkillInstallDialog', () => ({
  SkillInstallDialog: (props: { open: boolean; initialLink: string }) =>
    props.open ? <div data-testid="skill-install">{props.initialLink}</div> : null
}))
vi.mock('../skills/use-skill-install-detected-agents', () => ({
  useSkillInstallDetectedAgents: () => ['claude']
}))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams: () => Promise.resolve([]) }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { default: MarketplacePage } = await import('./MarketplacePage')
const { resetMarketplaceInstalledSkillsForTests } = await import('./MarketplaceCatalogSkills')

const roots: { container: HTMLDivElement; root: Root }[] = []

async function renderPage(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplacePage />
      </TooltipProvider>
    )
  })
  return container
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 8; tick += 1) {
      await Promise.resolve()
    }
  })
}

function buttonWithText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
}

async function clickButtonWithText(container: ParentNode, text: string): Promise<void> {
  const button = buttonWithText(container, text)
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  await act(async () => {
    button.click()
  })
}

function sectionHeading(container: ParentNode, name: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('h2')).find(
    (heading) => heading.textContent === name
  )
}

/** The grid (or the placeholder line) that follows a section heading. */
function sectionBody(container: ParentNode, name: string): Element | null {
  return sectionHeading(container, name)?.parentElement?.nextElementSibling ?? null
}

function itemRow(container: ParentNode, name: string): HTMLElement | undefined {
  const label = Array.from(container.querySelectorAll('span.block.truncate.font-medium')).find(
    (span) => span.textContent === name
  )
  const row = label?.closest('.grid > div')
  return row instanceof HTMLElement ? row : undefined
}

function statusOf(container: ParentNode, name: string): string | undefined {
  const buttons = itemRow(container, name)?.querySelectorAll('button')
  return buttons?.item(buttons.length - 1)?.textContent?.trim()
}

function namesIn(body: Element | null): string[] {
  return Array.from(body?.querySelectorAll('span.block.truncate.font-medium') ?? []).map(
    (span) => span.textContent ?? ''
  )
}

function yourAppRow(container: ParentNode, name: string): HTMLElement | undefined {
  const label = Array.from(container.querySelectorAll('span.block.truncate.font-medium')).find(
    (span) => span.textContent === name
  )
  const row = label?.closest('.px-4.py-3')
  return row instanceof HTMLElement ? row : undefined
}

function skill(name: string): DiscoveredSkill {
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
    installed: true,
    updatedAt: null
  }
}

/** A skill the person added from the Marketplace, which the Skills section lists. */
function addedSkill(name: string): DiscoveredSkill {
  return { ...skill(name), source: 'marketplace' }
}

function customSkillItem(
  id: string,
  name: string,
  presence: MarketplaceCustomItemStatus['presence']
): MarketplaceCustomItemStatus {
  return {
    id,
    kind: 'skill',
    name,
    checkCommand: null,
    install: {},
    skillUrl: `https://example.com/skills/${id}`,
    createdAt: 1,
    presence
  }
}

/** The list row a sidebar click hands the Marketplace page for an installed skill. */
function skillListRow(found: DiscoveredSkill): CatalogRow {
  return {
    key: `skill-${found.id}`,
    section: 'skills',
    name: found.name,
    description: '',
    icon: { kind: 'skill' },
    status: { kind: 'done', label: 'Installed' },
    target: { kind: 'skill', skill: found },
    owned: true,
    service: false,
    customId: null
  }
}

const connectedEngram: MarketplaceAppStatus = { id: 'engram', connected: true, agents: [] }
const disconnectedOpenMetadata: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: false,
  agents: []
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    resetMarketplaceInstalledSkillsForTests()
    mocks.detected = ['claude']
    mocks.discover.mockResolvedValue({ skills: [], sources: [], scannedAt: 1 })
    mocks.custom = []
    mocks.confirm.mockResolvedValue(true)
    // Why: the web client has no marketplace bridge; the page must still render.
    Object.assign(window, { api: undefined })
    seedStore(store, {
      activeView: 'marketplace',
      marketplaceSection: 'all',
      marketplaceSelectedItemId: null,
      settings: getDefaultSettings('/tmp'),
      preflightStatus: {
        git: { installed: true },
        gh: { installed: true, authenticated: false },
        glab: { installed: false, authenticated: false }
      },
      preflightStatusChecked: true,
      preflightStatusContextKey: 'local'
    })
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  it('shows the title, the host picker and Add custom, with no close button beside the title', async () => {
    const container = await renderPage()

    expect(container.querySelector('h1')?.textContent).toBe('Marketplace')
    expect(container.querySelector('button[aria-label="Close marketplace"]')).toBeNull()
    expect(buttonWithText(container, 'Add custom')).toBeDefined()
    const hostPicker = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('This computer')
    )
    expect(hostPicker?.textContent).toContain('Connected')
    expect(container.textContent).not.toContain('Only this computer for now')
  })

  it('shows the board subtitle under the title on the catalog', async () => {
    const container = await renderPage()
    expect(container.textContent).toContain(
      'Install the tools, agents and skills MassOrca uses on each host, and connect the services your agents and teams work with.'
    )
  })

  it('lists Tools, Agents, Skills and Services in order, each with its note', async () => {
    const container = await renderPage()

    expect(
      Array.from(container.querySelectorAll('h2')).map((heading) => heading.textContent)
    ).toEqual(['Tools', 'Agents', 'Skills', 'Services'])
    expect(container.textContent).toContain('On This computer')
    expect(container.textContent).toContain('On This computer. Each host has its own.')
    expect(container.textContent).toContain('For the agents on This computer')
    expect(container.textContent).toContain('Accounts are kept on each host')
  })

  it('puts each section in a two-column grid and shows the status at the right of each item', async () => {
    const container = await renderPage()

    expect(sectionBody(container, 'Tools')?.className).toContain('grid-cols-2')
    expect(namesIn(sectionBody(container, 'Tools'))).toEqual([
      'Git',
      'GitHub CLI',
      'Node.js',
      'Engram'
    ])
    expect(statusOf(container, 'Git')).toBe('Installed')
    expect(statusOf(container, 'GitHub CLI')).toBe('Installed')
    expect(statusOf(container, 'Node.js')).toBe('Install')
    expect(statusOf(container, 'Engram')).toBe('Available in the desktop app')
    expect(namesIn(sectionBody(container, 'Services'))).toEqual([
      'OpenMetadata',
      'GitHub',
      'GitLab',
      'Bitbucket',
      'Azure DevOps',
      'Gitea',
      'Linear',
      'Jira'
    ])
    expect(statusOf(container, 'OpenMetadata')).toBe('Available in the desktop app')
    expect(statusOf(container, 'GitHub')).toBe('Connect')
    for (const name of ['GitLab', 'Bitbucket', 'Azure DevOps', 'Gitea']) {
      expect(statusOf(container, name)).toBe('Connect')
    }
  })

  it('shows Node.js with a disabled Install button and lists no placeholder services', async () => {
    const container = await renderPage()

    const buttons = Array.from(itemRow(container, 'Node.js')?.querySelectorAll('button') ?? [])
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.disabled).toBe(true)
    expect(buttons[0]?.textContent).toBe('Install')
    for (const name of ['Email', 'Calendar', 'Shared drive', '[CRM]']) {
      expect(itemRow(container, name)).toBeUndefined()
    }
  })

  it('opens an integration from its row and returns to the catalog with Back', async () => {
    const container = await renderPage()

    await act(async () => {
      itemRow(container, 'Bitbucket')?.querySelector('button')?.click()
    })
    expect(container.querySelector('h2')?.textContent).toBe('Bitbucket')
    expect(container.querySelector('[data-marketplace-section="connection"]')).not.toBeNull()

    await clickButtonWithText(container, 'Back')
    expect(sectionHeading(container, 'Services')).toBeDefined()
  })

  it('shows Installed and Connected once the desktop reports the apps', async () => {
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: vi.fn(async () => [connectedEngram, disconnectedOpenMetadata])
        }
      }
    })
    const container = await renderPage()
    await flush()

    expect(statusOf(container, 'Engram')).toBe('Installed')
    expect(statusOf(container, 'OpenMetadata')).toBe('Connect')
  })

  it('lists only the four board agents, in board order, with Found or Install', async () => {
    const container = await renderPage()

    expect(namesIn(sectionBody(container, 'Agents'))).toEqual([
      'Claude Code',
      'Codex',
      'Antigravity',
      'Gentle Shell'
    ])
    expect(statusOf(container, 'Claude Code')).toBe('Found')
    expect(statusOf(container, 'Codex')).toBe('Install')
  })

  it('does not count a stock Pi install as Gentle Shell', async () => {
    mocks.detected = ['pi']
    const container = await renderPage()

    expect(statusOf(container, 'Gentle Shell')).toBe('Install')
    expect(container.textContent).not.toContain('Pi')
  })

  it('lists the skills found on this computer, each as Installed', async () => {
    mocks.discover.mockResolvedValue({
      skills: [addedSkill('alpha'), addedSkill('beta'), skill('sdd-init')],
      sources: [],
      scannedAt: 1
    })
    const container = await renderPage()
    await flush()

    expect(namesIn(sectionBody(container, 'Skills'))).toEqual([
      'Alpha',
      'Beta',
      'Browser use',
      'Computer use',
      'Linear',
      'Orchestration',
      'Price check',
      'Prototype',
      'Orca orchestration delegate'
    ])
    expect(statusOf(container, 'Alpha')).toBe('Installed')
    expect(statusOf(container, 'Browser use')).toBe('Install')
  })

  it('keeps the board skills listed when this computer finds no skill', async () => {
    mocks.discover.mockResolvedValue({ skills: [], sources: [], scannedAt: 1 })
    const container = await renderPage()
    await flush()

    expect(namesIn(sectionBody(container, 'Skills'))).toEqual([
      'Browser use',
      'Computer use',
      'Linear',
      'Orchestration',
      'Price check',
      'Prototype',
      'Orca orchestration delegate'
    ])
    expect(container.textContent).not.toContain('No skills found')
  })

  it('shows Your apps with the installed apps and the connected services', async () => {
    seedStore(store, { marketplaceSection: 'your-apps' })
    const container = await renderPage()

    expect(container.querySelector('h1')?.textContent).toBe('Your apps')
    expect(buttonWithText(container, 'Add custom')).toBeUndefined()
    expect(
      Array.from(container.querySelectorAll('h2')).map((heading) => heading.textContent)
    ).toEqual(['Installed', 'Connected'])
    const git = yourAppRow(container, 'Git')
    expect(git?.querySelector('[data-slot="badge"]')?.textContent).toBe('Installed')
    expect(git?.textContent).toContain('Open')
    expect(
      yourAppRow(container, 'GitHub CLI')?.querySelector('[data-slot="badge"]')?.textContent
    ).toBe('Installed')
    expect(yourAppRow(container, 'Node.js')).toBeUndefined()
    expect(yourAppRow(container, 'GitLab')).toBeUndefined()
    const claude = yourAppRow(container, 'Claude Code')
    expect(claude?.querySelector('[data-slot="badge"]')?.textContent).toBe('Found')
    expect(claude?.textContent).toContain('Manage with MassOrca')
    expect(container.textContent).toContain('No services are connected yet.')
  })

  it('opens Git from its row and returns to the catalog with Back', async () => {
    const container = await renderPage()
    const gitOpen = itemRow(container, 'Git')?.querySelector('button')

    await act(async () => {
      gitOpen?.click()
    })
    expect(container.textContent).toContain('Git is installed on this computer.')

    await clickButtonWithText(container, 'Back')
    expect(container.querySelector('h1')?.textContent).toBe('Marketplace')
  })

  it('opens the Add custom dialog with the board fields for a tool', async () => {
    const container = await renderPage()
    await clickButtonWithText(container, 'Add custom')

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Add custom')
    for (const label of ['Tool', 'Agent', 'Skill', 'Name', 'How to tell it is installed']) {
      expect(dialog?.textContent).toContain(label)
    }
    for (const label of ['How to install it', 'Windows', 'macOS', 'Linux']) {
      expect(dialog?.textContent).toContain(label)
    }
    expect(dialog?.textContent).toContain('Leave a system empty if the app does not run there.')
    expect(dialog?.querySelector('input[placeholder="[app name]"]')).not.toBeNull()
    expect(dialog?.querySelector('input[placeholder="mytool --version"]')).not.toBeNull()
    expect(
      dialog?.querySelector('input[placeholder="winget install --id [package id] -e"]')
    ).not.toBeNull()
    expect(dialog?.querySelector('input[placeholder="brew install [package]"]')).not.toBeNull()
    expect(
      dialog?.querySelector('input[placeholder="sudo apt-get install -y [package]"]')
    ).not.toBeNull()
    expect(buttonWithText(dialog ?? document.body, 'Cancel')).toBeDefined()
    expect(buttonWithText(dialog ?? document.body, 'Add')).toBeDefined()
  })

  it('adds a tool through the desktop bridge with its name and check command', async () => {
    const add = vi.fn(async () => ({ ok: false as const, reason: 'failed' as const }))
    Object.assign(window, {
      api: {
        marketplaceCustom: {
          list: vi.fn(async () => []),
          add,
          remove: vi.fn(),
          install: vi.fn(),
          onInstallEvent: () => () => undefined
        }
      }
    })
    const container = await renderPage()
    await clickButtonWithText(container, 'Add custom')

    const dialog = document.querySelector('[role="dialog"]')
    const name = dialog?.querySelector<HTMLInputElement>('input[placeholder="[app name]"]')
    const check = dialog?.querySelector<HTMLInputElement>('input[placeholder="mytool --version"]')
    if (!name || !check) {
      throw new Error('Add custom fields missing')
    }
    setInputValue(name, 'Mytool')
    setInputValue(check, 'mytool --version')
    await clickButtonWithText(dialog ?? document.body, 'Add')

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'tool', name: 'Mytool', checkCommand: 'mytool --version' })
    )
  })

  it('hands a skill link to the existing install-from-link flow', async () => {
    const container = await renderPage()
    await clickButtonWithText(container, 'Add custom')

    const dialog = document.querySelector('[role="dialog"]')
    const skillTab = Array.from(dialog?.querySelectorAll('[role="tab"]') ?? []).find(
      (tab) => tab.textContent === 'Skill'
    )
    if (!(skillTab instanceof HTMLElement)) {
      throw new Error('Skill tab missing')
    }
    await act(async () => {
      skillTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    })
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Link to the skill')

    const link = document.querySelector<HTMLInputElement>(
      'input[placeholder="https://github.com/[owner]/[repo]"]'
    )
    if (!link) {
      throw new Error('Skill link field missing')
    }
    setInputValue(link, 'https://github.com/acme/skill')
    await clickButtonWithText(document.querySelector('[role="dialog"]') ?? document.body, 'Add')

    expect(document.querySelector('[data-testid="skill-install"]')?.textContent).toBe(
      'https://github.com/acme/skill'
    )
  })

  it('opens a skill row on its own page inside the Marketplace, and Marketplace returns to the list', async () => {
    mocks.discover.mockResolvedValue({ skills: [addedSkill('alpha')], sources: [], scannedAt: 1 })
    const container = await renderPage()
    await flush()

    await act(async () => {
      itemRow(container, 'Alpha')?.querySelector('button')?.click()
    })
    await flush()

    expect(store.getState().activeView).toBe('marketplace')
    expect(container.querySelector('h2')?.textContent).toBe('Alpha')
    expect(container.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on This computer'
    )
    await act(async () => {
      container.querySelector<HTMLButtonElement>('nav button')?.click()
    })
    expect(container.querySelector('h1')?.textContent).toBe('Marketplace')
  })

  it('opens each built-in command on its own page, and Marketplace returns to the list', async () => {
    const container = await renderPage()
    await flush()
    await act(async () => {
      itemRow(container, 'Prototype')?.querySelector('button')?.click()
    })
    await flush()
    expect(container.querySelector('h2')?.textContent).toBe('Prototype')
    expect(container.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Built into MassOrca'
    )
    await act(async () => {
      container.querySelector<HTMLButtonElement>('nav button')?.click()
    })
    expect(container.querySelector('h1')?.textContent).toBe('Marketplace')
  })

  it('opens an installed custom skill on its own page', async () => {
    mocks.custom = [customSkillItem('team', 'Team skill', 'found')]
    const container = await renderPage()
    await flush()
    expect(statusOf(container, 'Team skill')).toBe('Installed')
    await act(async () => {
      itemRow(container, 'Team skill')?.querySelector('button')?.click()
    })
    await flush()
    expect(container.querySelector('h2')?.textContent).toBe('Team skill')
    expect(container.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on This computer'
    )
  })

  it('opens the skill a sidebar click asks for, on its own page', async () => {
    mocks.discover.mockResolvedValue({ skills: [addedSkill('alpha')], sources: [], scannedAt: 1 })
    const container = await renderPage()
    await flush()
    await act(async () => {
      requestSkillRowOpen(skillListRow(addedSkill('alpha')))
    })
    await flush()
    expect(container.querySelector('h2')?.textContent).toBe('Alpha')
  })

  it('lists a skill two agent folders hold once, and its page shows every copy', async () => {
    const claude: DiscoveredSkill = {
      ...addedSkill('alpha'),
      id: 'skill-claude-alpha',
      sourceLabel: 'Claude home',
      rootPath: '/home/dev/.claude/skills',
      directoryPath: '/home/dev/.claude/skills/alpha',
      skillFilePath: '/home/dev/.claude/skills/alpha/SKILL.md'
    }
    const codex: DiscoveredSkill = {
      ...addedSkill('alpha'),
      id: 'skill-codex-alpha',
      sourceLabel: 'Codex home',
      rootPath: '/home/dev/.codex/skills',
      directoryPath: '/home/dev/.codex/skills/alpha',
      skillFilePath: '/home/dev/.codex/skills/alpha/SKILL.md'
    }
    mocks.discover.mockResolvedValue({ skills: [claude, codex], sources: [], scannedAt: 1 })
    const container = await renderPage()
    await flush()
    expect(
      namesIn(sectionBody(container, 'Skills')).filter((name) => name === 'Alpha')
    ).toHaveLength(1)
    await act(async () => {
      itemRow(container, 'Alpha')?.querySelector('button')?.click()
    })
    await flush()
    const copies = container.querySelector('[data-marketplace-skill-copies]')
    expect(copies?.textContent).toContain('/home/dev/.claude/skills/alpha')
    expect(copies?.textContent).toContain('/home/dev/.codex/skills/alpha')
  })

  it('removes the skill on this computer through the delete API, then the list rescans', async () => {
    mocks.discover.mockResolvedValue({ skills: [addedSkill('alpha')], sources: [], scannedAt: 1 })
    mocks.preview.mockResolvedValue({
      operationId: 'op-1',
      skills: [
        {
          id: 'skill-alpha',
          name: 'alpha',
          canonicalPath: '/home/dev/.agents/skills/alpha',
          placements: [
            {
              path: '/home/dev/.agents/skills/alpha',
              kind: 'canonical',
              rootLabel: 'Agent skills home'
            }
          ]
        }
      ]
    })
    mocks.remove.mockResolvedValue({
      operationId: 'op-1',
      skills: [
        {
          id: 'skill-alpha',
          name: 'alpha',
          status: 'deleted',
          removedPaths: ['/home/dev/.agents/skills/alpha']
        }
      ]
    })
    const container = await renderPage()
    await flush()
    const scansBefore = mocks.discover.mock.calls.length
    await act(async () => {
      itemRow(container, 'Alpha')?.querySelector('button')?.click()
    })
    await flush()
    await clickButtonWithText(container, 'Remove from This computer')
    await flush()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({
        skills: [expect.objectContaining({ id: 'skill-alpha' })]
      })
    )
    expect(mocks.discover.mock.calls.length).toBeGreaterThan(scansBefore)
    expect(container.querySelector('h1')?.textContent).toBe('Marketplace')
  })
})

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
