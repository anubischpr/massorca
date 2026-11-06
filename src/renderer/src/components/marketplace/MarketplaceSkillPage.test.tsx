// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceSkillPageSkill } from './MarketplaceSkillPageModel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Mocks = {
  teams: BotTeam[]
  detected: string[] | null
  targets: MarketplaceVaultHostTarget[]
}

const mocks = vi.hoisted((): Mocks => ({
  teams: [],
  detected: ['claude', 'codex', 'pi'],
  targets: []
}))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams: () => Promise.resolve(mocks.teams)
}))
vi.mock('../skills/use-skill-install-detected-agents', () => ({
  useSkillInstallDetectedAgents: () => mocks.detected
}))
vi.mock('../skills/SkillInstallDialog', () => ({
  SkillInstallDialog: ({ initialLink }: { initialLink?: string }) => (
    <div data-install-dialog={initialLink ?? ''} />
  )
}))
vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => mocks.targets
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

  it('leaves out the host dropdown when there is no other host to pick', async () => {
    mocks.targets = []
    const page = await renderPage()
    expect(hostTrigger(page)).toBeNull()
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
