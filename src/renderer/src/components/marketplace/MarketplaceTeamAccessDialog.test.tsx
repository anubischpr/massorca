// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppStatus
} from '../../../../shared/marketplace-apps'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { TuiAgent } from '../../../../shared/tui-agent'

const mocks = vi.hoisted(() => ({
  state: {
    marketplaceApps: { status: 'ready', apps: [] } as unknown,
    refreshMarketplaceApps: vi.fn(async () => undefined)
  },
  setAccessPolicy: vi.fn()
}))

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/store', () => ({
  useAppStore: <T,>(selector: (state: typeof mocks.state) => T): T => selector(mocks.state)
}))
vi.mock('@/components/bot-teams/BotTeamCharacterIcon', () => ({
  BotTeamCharacterIcon: ({ character }: { character: string }) => <i data-character={character} />
}))

const { MarketplaceTeamAccessDialog } = await import('./MarketplaceTeamAccessDialog')
const { MARKETPLACE_APP_INFO } = await import('./marketplace-app-info')

function bot(id: string, agent: TuiAgent): BotTeamBot {
  return { id, name: id, job: '', agent, modelMode: 'auto', model: null, effort: null, skills: [] }
}

function teamWith(agents: TuiAgent[]): BotTeam {
  return {
    id: 'team-a',
    name: 'Alpha',
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: agents.map((agent, index) => bot(`bot-${index + 1}`, agent))
  }
}

function app(
  id: MarketplaceAppStatus['id'],
  access?: MarketplaceAppAccessPolicy,
  connected = true
): MarketplaceAppStatus {
  return { id, connected, agents: [], access }
}

const roots: Root[] = []

async function render(team: BotTeam, open = true): Promise<void> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<MarketplaceTeamAccessDialog team={team} open={open} onOpenChange={vi.fn()} />)
  })
}

function switches(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[role="switch"]')]
}

async function clickSwitch(index: number): Promise<void> {
  const target = switches()[index]
  await act(async () => {
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function setApps(apps: MarketplaceAppStatus[]): void {
  mocks.state.marketplaceApps = { status: 'ready', apps }
}

describe('MarketplaceTeamAccessDialog', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.setAccessPolicy.mockReset()
    mocks.setAccessPolicy.mockImplementation(async () => ({ ok: true, status: app('engram') }))
    mocks.state.refreshMarketplaceApps.mockClear()
    window.api = { marketplaceApps: { setAccessPolicy: mocks.setAccessPolicy } } as never
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('titles the dialog with the team and lists only connected apps', async () => {
    setApps([app('engram'), app('github', undefined, false)])
    await render(teamWith(['claude']))
    const title = document.querySelector('[data-slot="dialog-title"]')
    expect(title?.textContent).toContain('Marketplace apps for Alpha')
    expect(document.body.textContent).toContain(MARKETPLACE_APP_INFO.engram.name)
    expect(document.body.textContent).not.toContain(MARKETPLACE_APP_INFO.github.name)
    expect(switches()).toHaveLength(1)
  })

  it('turns a team off for an app by saving an except policy that names only that team', async () => {
    setApps([app('engram')])
    await render(teamWith(['claude']))
    expect(switches()[0]?.getAttribute('aria-checked')).toBe('true')
    await clickSwitch(0)
    expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
      id: 'engram',
      policy: {
        agents: { mode: 'everyone', ids: [] },
        bots: { mode: 'except', botIds: [], teamIds: ['team-a'] }
      }
    })
  })

  it('turns a team back on by removing it from an except list', async () => {
    setApps([
      app('engram', {
        agents: { mode: 'everyone', ids: [] },
        bots: { mode: 'except', botIds: [], teamIds: ['team-a'] }
      })
    ])
    await render(teamWith(['claude']))
    expect(switches()[0]?.getAttribute('aria-checked')).toBe('false')
    await clickSwitch(0)
    expect(mocks.setAccessPolicy).toHaveBeenCalledWith({
      id: 'engram',
      policy: {
        agents: { mode: 'everyone', ids: [] },
        bots: { mode: 'except', botIds: [], teamIds: [] }
      }
    })
  })

  it('refuses to turn off an app for a team with an Antigravity bot and saves nothing', async () => {
    setApps([app('engram')])
    await render(teamWith(['claude', 'antigravity']))
    await clickSwitch(0)
    expect(mocks.setAccessPolicy).not.toHaveBeenCalled()
    const status = document.querySelector('[role="status"]')
    expect(status?.textContent).toBe(MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE)
  })

  it('disables every switch while a save is in flight', async () => {
    setApps([app('engram'), app('openmetadata')])
    let finish: () => void = () => undefined
    mocks.setAccessPolicy.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: true, status: app('engram') })
        })
    )
    await render(teamWith(['claude']))
    await clickSwitch(0)
    expect(switches().every((item) => item.disabled)).toBe(true)
    await act(async () => finish())
    expect(switches().every((item) => !item.disabled)).toBe(true)
  })

  it('shows the empty state when no app is connected', async () => {
    setApps([app('engram', undefined, false)])
    await render(teamWith(['claude']))
    expect(document.body.textContent).toContain(
      'No apps are connected yet. Connect them from the Marketplace.'
    )
    expect(switches()).toHaveLength(0)
  })
})
