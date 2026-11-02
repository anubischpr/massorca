/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamWebhooks = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client-webhooks', () => ({ listBotTeamWebhooks }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { BotTeamWebhookSection } = await import('./BotTeamWebhookSection')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'mk',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [{ ...BOT, id: 'nora', name: 'Nora', job: 'Writes', agent: 'claude' }]
}
const HOOK = { id: 'h1', teamId: 'mk', botId: 'nora', lastCall: null }

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount(listed: unknown) {
  listBotTeamWebhooks.mockResolvedValue(listed)
  const onOpen = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamWebhookSection team={TEAM} onOpen={onOpen} />))
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name)
  return { container, button, onOpen }
}

describe('Web addresses', () => {
  it('offers the first one when there is none', async () => {
    const { container, button, onOpen } = await mount({
      webhooks: [],
      endpoint: { state: 'unavailable' }
    })
    expect(container.textContent).toContain('Web addresses')
    expect(container.textContent).toContain('No web addresses yet')
    expect(container.textContent).toContain(
      'Another app can call a web address, a webhook, to start one task in Marketing.'
    )
    act(() => button('New web address')?.click())
    expect(onOpen).toHaveBeenCalledWith()
  })

  it('lists an address with its bot and last call, and opens it', async () => {
    const { container, button, onOpen } = await mount({
      webhooks: [{ ...HOOK, lastCall: { date: '2026-11-02', time: '14:05' } }],
      endpoint: { state: 'ready', baseUrl: 'https://host.example' }
    })
    expect(container.textContent).toContain('Start a task from another app')
    expect(container.textContent).toMatch(/Nora\. One task for each call\. Last call .+\./)
    expect(container.textContent).not.toContain('does not take calls yet')
    act(() => button('Open')?.click())
    expect(onOpen).toHaveBeenCalledWith('h1')
  })

  it('says when an address has not been called, and when the host cannot take calls', async () => {
    const { container } = await mount({ webhooks: [HOOK], endpoint: { state: 'unavailable' } })
    expect(container.textContent).toContain('Nora. One task for each call. No calls yet.')
    expect(container.textContent).toContain('This host does not take calls yet.')
  })

  it('says so on a host from before web addresses', async () => {
    const { container, button } = await mount('unavailable')
    expect(container.textContent).toContain('This host cannot make web addresses yet.')
    expect(button('New web address')).toBeUndefined()
  })
})
