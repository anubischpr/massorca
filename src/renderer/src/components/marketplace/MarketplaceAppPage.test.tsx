// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  everyoneAccessPolicy,
  type MarketplaceAppId,
  type MarketplaceAppStatus
} from '../../../../shared/marketplace-apps'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const apps: MarketplaceAppStatus[] = []
  const teams: BotTeam[] = []
  return {
    apps,
    teams,
    listApps: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setOpenMetadataToken: vi.fn(),
    addOpenMetadataProfile: vi.fn(),
    removeOpenMetadataProfile: vi.fn(),
    setEngramServer: vi.fn(),
    setAccessPolicy: vi.fn(),
    writeClipboardText: vi.fn(),
    openUrl: vi.fn(),
    listHostBindableAccounts: vi.fn()
  }
})

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
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => {
    const labels: Record<string, string> = {
      claude: 'Claude Code',
      codex: 'Codex',
      antigravity: 'Antigravity'
    }
    return labels[agent] ?? agent
  }
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('@/components/bot-teams/use-bot-teams', () => ({
  useBotTeams: () => ({
    teams: mocks.teams,
    failed: false,
    lastSeenAt: null,
    reload: () => undefined,
    applyChange: async () => true
  })
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAppPage } = await import('./MarketplaceAppPage')

const engram: MarketplaceAppStatus = {
  id: 'engram',
  connected: true,
  program: { found: true, version: '0.9.2' },
  credential: { stored: false },
  serverUrl: null,
  agents: [
    { agent: 'claude', level: 'full', entry: 'set' },
    { agent: 'codex', level: 'full', entry: 'built-in' },
    { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
    { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
  ]
}

const openmetadata: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: true,
  serverUrl: 'https://metadata.example.com',
  credential: { stored: true },
  profiles: [{ name: 'prod', url: 'https://prod.example.com', hasToken: true }],
  agents: [
    { agent: 'claude', level: 'full', entry: 'set' },
    { agent: 'codex', level: 'full', entry: 'set' },
    { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
    { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
  ]
}

const github: MarketplaceAppStatus = { id: 'github', connected: true, agents: [] }

const roots: { container: HTMLDivElement; root: Root }[] = []

async function mount(appId: MarketplaceAppId): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceAppPage appId={appId} onBack={() => {}} />
      </TooltipProvider>
    )
  })
  return container
}

function sectionOf(container: ParentNode, id: string): HTMLElement {
  const section = container.querySelector<HTMLElement>(`[data-marketplace-section="${id}"]`)
  if (!section) {
    throw new Error(`Section ${id} missing`)
  }
  return section
}

function headerOf(container: ParentNode): HTMLElement {
  const header = container.querySelector<HTMLElement>('header')
  if (!header) {
    throw new Error('Header missing')
  }
  return header
}

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
}

function clickButton(scope: ParentNode, text: string): Promise<void> {
  const button = buttonWithText(scope, text)
  if (!button) {
    throw new Error(`Button missing: ${text}`)
  }
  return act(async () => {
    button.click()
  })
}

function inputById(id: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)
  if (!input) {
    throw new Error(`Input missing: ${id}`)
  }
  return input
}

function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  return act(async () => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function submitDialog(): Promise<void> {
  const form = document.querySelector('form')
  if (!form) {
    throw new Error('Dialog form missing')
  }
  return act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function sectionIds(container: ParentNode): (string | null)[] {
  return [...container.querySelectorAll('[data-marketplace-section]')].map((section) =>
    section.getAttribute('data-marketplace-section')
  )
}

function seedApps(apps: MarketplaceAppStatus[]): void {
  mocks.apps = apps
  seedStore(store, { marketplaceApps: { status: 'ready', apps } })
}

describe('MarketplaceAppPage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.listApps.mockImplementation(async () => mocks.apps)
    mocks.connect.mockResolvedValue({ ok: true, status: engram })
    mocks.disconnect.mockResolvedValue({ ok: true, status: { ...engram, connected: false } })
    mocks.setOpenMetadataToken.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.addOpenMetadataProfile.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.removeOpenMetadataProfile.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.setEngramServer.mockResolvedValue({ ok: true, status: engram })
    mocks.setAccessPolicy.mockResolvedValue({ ok: true, status: engram })
    mocks.teams.splice(0)
    mocks.writeClipboardText.mockResolvedValue(undefined)
    mocks.openUrl.mockResolvedValue(undefined)
    mocks.listHostBindableAccounts.mockResolvedValue({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'personal',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo']
        }
      ]
    })
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: mocks.listApps,
          connect: mocks.connect,
          disconnect: mocks.disconnect,
          setOpenMetadataToken: mocks.setOpenMetadataToken,
          addOpenMetadataProfile: mocks.addOpenMetadataProfile,
          removeOpenMetadataProfile: mocks.removeOpenMetadataProfile,
          setEngramServer: mocks.setEngramServer,
          setAccessPolicy: mocks.setAccessPolicy
        },
        ui: { writeClipboardText: mocks.writeClipboardText },
        shell: { openUrl: mocks.openUrl },
        gh: {
          listHostBindableAccounts: mocks.listHostBindableAccounts,
          switchActiveAccount: vi.fn(),
          startSignIn: vi.fn(async () => ({ ok: true })),
          cancelSignIn: vi.fn(async () => {}),
          onSignInEvent: vi.fn(() => () => {})
        }
      }
    })
    seedStore(store, {
      activeView: 'marketplace',
      marketplaceApps: { status: 'ready', apps: [engram, openmetadata, github] },
      preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: true } },
      preflightStatusChecked: true,
      preflightStatusContextKey: 'local'
    })
    mocks.apps = [engram, openmetadata, github]
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  describe.each<MarketplaceAppId>(['engram', 'openmetadata', 'github'])('the %s page', (appId) => {
    it('shows Connection, Information, Advanced options and Danger zone in that order', async () => {
      const container = await mount(appId)
      expect(sectionIds(container)).toEqual(['connection', 'information', 'advanced', 'danger'])
    })

    it('has no per-agent switches in Connection', async () => {
      const container = await mount(appId)
      expect(sectionOf(container, 'connection').querySelectorAll('[role="switch"]')).toHaveLength(0)
    })
  })

  it("shows Gentle Shell's own Engram as Full integration", async () => {
    seedApps([
      {
        ...engram,
        agents: [
          ...engram.agents.slice(0, 3),
          { agent: 'gentle-shell', level: 'full', entry: 'built-in' }
        ]
      },
      openmetadata,
      github
    ])
    const container = await mount('engram')
    const rows = [...sectionOf(container, 'information').querySelectorAll('li')].map(
      (row) => row.textContent ?? ''
    )
    expect(rows[3]).toContain('Gentle Shell')
    expect(rows[3]).toContain('Full integration')
    expect(rows[3]).toContain('Built into its harness')
  })

  it('shows each agent with its integration level or Built in in Information', async () => {
    const container = await mount('engram')
    const rows = [...sectionOf(container, 'information').querySelectorAll('li')].map(
      (row) => row.textContent ?? ''
    )
    expect(rows).toHaveLength(4)
    expect(rows[0]).toContain('Claude Code')
    expect(rows[0]).toContain('Full integration')
    expect(rows[1]).toContain('Codex')
    expect(rows[1]).toContain('Built in')
    expect(rows[2]).toContain('Antigravity')
    expect(rows[2]).toContain('Tools only')
    expect(rows[3]).toContain('Gentle Shell')
    expect(rows[3]).toContain('Tools only')
  })

  it('connects OpenMetadata with the address and token, and never shows the token', async () => {
    seedApps([
      engram,
      {
        ...openmetadata,
        connected: false,
        serverUrl: null,
        credential: { stored: false },
        profiles: []
      },
      github
    ])
    mocks.connect.mockResolvedValue({ ok: true, status: openmetadata })
    const container = await mount('openmetadata')

    await clickButton(headerOf(container), 'Connect')
    await typeInto(inputById('marketplace-openmetadata-address'), 'https://metadata.example.com')
    await typeInto(inputById('marketplace-openmetadata-token'), 'token-value-42')
    await submitDialog()

    expect(mocks.connect).toHaveBeenCalledWith({
      id: 'openmetadata',
      url: 'https://metadata.example.com',
      token: 'token-value-42'
    })
    expect(document.body.textContent).not.toContain('token-value-42')
  })

  it('connects Engram from the header and reports a missing install', async () => {
    seedApps([{ ...engram, connected: false }, openmetadata, github])
    const container = await mount('engram')
    await clickButton(headerOf(container), 'Connect')
    expect(mocks.connect).toHaveBeenCalledWith({ id: 'engram' })

    seedApps([
      { ...engram, connected: false, program: { found: false, version: null } },
      openmetadata,
      github
    ])
    const missing = await mount('engram')
    expect(sectionOf(missing, 'connection').textContent).toContain('Not found')
    expect(buttonWithText(sectionOf(missing, 'connection'), 'Install instructions')).toBeDefined()
    expect(buttonWithText(headerOf(missing), 'Connect')?.disabled).toBe(true)
  })

  it('asks before disconnecting, then disconnects and refreshes the status', async () => {
    const container = await mount('engram')

    await clickButton(sectionOf(container, 'danger'), 'Disconnect')
    expect(mocks.disconnect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Disconnect Engram?')

    mocks.apps = [{ ...engram, connected: false }, openmetadata, github]
    await submitDialog()

    expect(mocks.disconnect).toHaveBeenCalledWith({ id: 'engram' })
    expect(headerOf(container).textContent).toContain('Not connected')
  })

  it('removes and adds OpenMetadata profiles through the server', async () => {
    const container = await mount('openmetadata')

    await clickButton(sectionOf(container, 'advanced'), 'Remove')
    expect(mocks.removeOpenMetadataProfile).toHaveBeenCalledWith({ name: 'prod' })

    await clickButton(sectionOf(container, 'advanced'), 'Add a profile')
    await typeInto(inputById('marketplace-profile-name'), 'staging')
    await typeInto(inputById('marketplace-profile-address'), 'https://staging.example.com')
    await typeInto(inputById('marketplace-profile-token'), 'staging-token')
    await submitDialog()

    expect(mocks.addOpenMetadataProfile).toHaveBeenCalledWith({
      name: 'staging',
      url: 'https://staging.example.com',
      token: 'staging-token'
    })
  })

  it('copies the deep link and an example prompt with its @ mention', async () => {
    const container = await mount('engram')

    await clickButton(headerOf(container), 'Copy link')
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('massorca://marketplace/engram')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy this prompt"]')?.click()
    })
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(
      '@Engram What did we decide about the release branch last week?'
    )
  })

  it('opens the in-app GitHub sign-in for a new account, with no Connect button while connected', async () => {
    const container = await mount('github')

    expect(buttonWithText(headerOf(container), 'Connect')).toBeUndefined()
    await clickButton(sectionOf(container, 'connection'), 'Add account')

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(mocks.writeClipboardText).not.toHaveBeenCalledWith('gh auth login')
  })

  it('shows the active GitHub account for new projects in Advanced options', async () => {
    const container = await mount('github')
    await act(async () => {})
    expect(sectionOf(container, 'advanced').textContent).toContain('personal')
  })

  it('sets the address of your own Engram server through a dialog', async () => {
    const container = await mount('engram')

    await clickButton(sectionOf(container, 'advanced'), 'Add')
    await typeInto(inputById('marketplace-engram-server'), 'https://engram.example.com')
    await submitDialog()

    expect(mocks.setEngramServer).toHaveBeenCalledWith({ url: 'https://engram.example.com' })
  })

  it('shows the desktop-only notice and no sections without the desktop bridge', async () => {
    Object.assign(window, { api: undefined })
    seedStore(store, { marketplaceApps: { status: 'unavailable' } })
    const container = await mount('openmetadata')

    expect(container.textContent).toContain('Available in the desktop app')
    expect(sectionIds(container)).toEqual([])
  })

  describe('Who can use it', () => {
    const AGENTS_MODE = 'Workspaces agents: who can use it'
    const BOTS_MODE = 'Bot teams: who can use it'
    const EVERYONE = everyoneAccessPolicy()
    const alphaTeam: BotTeam = {
      id: 'team-alpha',
      name: 'Alpha',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      accessMode: 'default',
      bots: [
        {
          id: 'bot-max',
          name: 'Max',
          job: 'Writes code',
          agent: 'claude',
          modelMode: 'auto',
          model: null,
          effort: null,
          skills: []
        },
        {
          id: 'bot-ana',
          name: 'Ana',
          job: 'Reviews code',
          agent: 'codex',
          modelMode: 'auto',
          model: null,
          effort: null,
          skills: []
        }
      ]
    }

    function radioOf(scope: ParentNode, label: string, option: string): HTMLButtonElement {
      const group = scope.querySelector(`[aria-label="${label}"]`)
      const radio = [...(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find(
        (button) => button.textContent?.trim() === option
      )
      if (!radio) {
        throw new Error(`Option missing: ${option}`)
      }
      return radio
    }

    function checkboxFor(scope: ParentNode, label: string): HTMLButtonElement {
      const row = [...scope.querySelectorAll('label')].find(
        (element) => element.textContent?.trim() === label
      )
      const checkbox = row?.querySelector<HTMLButtonElement>('button[role="checkbox"]')
      if (!checkbox) {
        throw new Error(`Checkbox missing: ${label}`)
      }
      return checkbox
    }

    it.each<MarketplaceAppId>(['engram', 'openmetadata', 'github'])(
      'defaults agents and bots to Everyone on the %s page',
      async (appId) => {
        const container = await mount(appId)
        expect(radioOf(container, AGENTS_MODE, 'Everyone').getAttribute('aria-checked')).toBe(
          'true'
        )
        expect(radioOf(container, BOTS_MODE, 'Everyone').getAttribute('aria-checked')).toBe('true')
        expect(mocks.setAccessPolicy).not.toHaveBeenCalled()
      }
    )

    it('saves Only these for agents, with nobody picked yet', async () => {
      const container = await mount('engram')
      await act(async () => {
        radioOf(container, AGENTS_MODE, 'Only these').click()
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, agents: { mode: 'only', ids: [] } }
      })
    })

    it('adds an agent to the picks of a limited app in one save', async () => {
      seedApps([
        { ...engram, access: { ...EVERYONE, agents: { mode: 'only', ids: [] } } },
        openmetadata,
        github
      ])
      const container = await mount('engram')
      await act(async () => {
        checkboxFor(container, 'Codex').click()
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, agents: { mode: 'only', ids: ['codex'] } }
      })
    })

    it('removes a picked bot from the chips and keeps the others', async () => {
      mocks.teams.push(alphaTeam)
      seedApps([
        {
          ...engram,
          access: {
            ...EVERYONE,
            bots: { mode: 'only', botIds: ['bot-max', 'bot-ana'], teamIds: [] }
          }
        },
        openmetadata,
        github
      ])
      const container = await mount('engram')
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Remove Max"]')?.click()
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, bots: { mode: 'only', botIds: ['bot-ana'], teamIds: [] } }
      })
    })

    it('adds a whole team from the picker', async () => {
      mocks.teams.push(alphaTeam)
      seedApps([
        { ...engram, access: { ...EVERYONE, bots: { mode: 'except', botIds: [], teamIds: [] } } },
        openmetadata,
        github
      ])
      await mount('engram')
      await clickButton(document.body, 'Add a bot or team')
      const wholeTeam = [...document.querySelectorAll('[cmdk-item]')].find((item) =>
        item.textContent?.includes('Whole team')
      )
      await act(async () => {
        wholeTeam?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, bots: { mode: 'except', botIds: [], teamIds: ['team-alpha'] } }
      })
    })

    const leoTeam: BotTeam = {
      ...alphaTeam,
      id: 'team-leo',
      name: 'Leo team',
      bots: [{ ...alphaTeam.bots[0], id: 'bot-leo', name: 'Leo', agent: 'antigravity' }]
    }
    const ANTIGRAVITY_NOTICE = "a bot on Antigravity can't be kept out of one"

    it('keeps an Antigravity bot picked under Only these and says why', async () => {
      mocks.teams.push(alphaTeam, leoTeam)
      const container = await mount('engram')
      await act(async () => {
        radioOf(container, BOTS_MODE, 'Only these').click()
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, bots: { mode: 'only', botIds: ['bot-leo'], teamIds: [] } }
      })
      expect(container.textContent).toContain(ANTIGRAVITY_NOTICE)
    })

    it('refuses to keep a team with an Antigravity bot out of an app', async () => {
      mocks.teams.push(leoTeam)
      seedApps([
        { ...engram, access: { ...EVERYONE, bots: { mode: 'except', botIds: [], teamIds: [] } } },
        openmetadata,
        github
      ])
      const container = await mount('engram')
      await clickButton(document.body, 'Add a bot or team')
      const wholeTeam = [...document.querySelectorAll('[cmdk-item]')].find((item) =>
        item.textContent?.includes('Whole team')
      )
      await act(async () => {
        wholeTeam?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(mocks.setAccessPolicy).not.toHaveBeenCalled()
      expect(container.textContent).toContain(ANTIGRAVITY_NOTICE)
    })

    it('limits other bots without a notice when no Antigravity bot is affected', async () => {
      mocks.teams.push(alphaTeam)
      const container = await mount('engram')
      await act(async () => {
        radioOf(container, BOTS_MODE, 'Only these').click()
      })
      expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
        id: 'engram',
        policy: { ...EVERYONE, bots: { mode: 'only', botIds: [], teamIds: [] } }
      })
      expect(container.textContent).not.toContain(ANTIGRAVITY_NOTICE)
    })

    it('says that GitHub limits only change what MassOrca shows', async () => {
      const container = await mount('github')
      expect(container.textContent).toContain('For GitHub this only changes what MassOrca shows.')
    })
  })

  it('names each app in its example chip without an @, and keeps the @ in the hint', async () => {
    const container = await mount('openmetadata')
    const chips = [...container.querySelectorAll('span')].map((span) => span.textContent?.trim())
    expect(chips).toContain('OpenMetadata')
    expect(chips).not.toContain('@OpenMetadata')
    expect(container.textContent).toContain(
      'Type @OpenMetadata in any chat or room to ask it directly.'
    )
  })

  it('keeps one Connect button, in the header beside Copy link, when OpenMetadata is not connected', async () => {
    seedApps([
      engram,
      {
        ...openmetadata,
        connected: false,
        serverUrl: null,
        credential: { stored: false },
        profiles: []
      },
      github
    ])
    const container = await mount('openmetadata')
    expect(buttonWithText(headerOf(container), 'Copy link')).toBeDefined()
    expect(buttonWithText(headerOf(container), 'Connect')).toBeDefined()
    expect(buttonWithText(sectionOf(container, 'connection'), 'Connect')).toBeUndefined()
  })

  it('shows the Server address and Token rows with Change and Add token, as on the board', async () => {
    seedApps([
      engram,
      {
        ...openmetadata,
        connected: false,
        serverUrl: null,
        credential: { stored: false },
        profiles: []
      },
      github
    ])
    const container = await mount('openmetadata')
    const connection = sectionOf(container, 'connection')
    expect(connection.textContent).toContain('Server address')
    expect(connection.textContent).toContain('Token')
    expect(connection.textContent).toContain(
      'Not set. Kept in the MassOrca vault and never shown once saved.'
    )
    expect(buttonWithText(connection, 'Change')).toBeDefined()
    expect(buttonWithText(connection, 'Add token')).toBeDefined()
  })

  it('lists how each agent uses OpenMetadata whether or not it is connected', async () => {
    seedApps([
      engram,
      {
        ...openmetadata,
        connected: false,
        serverUrl: null,
        credential: { stored: false },
        profiles: []
      },
      github
    ])
    const container = await mount('openmetadata')
    const rows = [...sectionOf(container, 'information').querySelectorAll('li')].map(
      (row) => row.textContent ?? ''
    )
    expect(rows).toHaveLength(4)
    expect(rows[0]).toContain('Claude Code')
    expect(rows[3]).toContain('Gentle Shell')
  })
})
