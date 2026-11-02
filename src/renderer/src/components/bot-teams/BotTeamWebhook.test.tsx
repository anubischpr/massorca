/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  listBotTeamWebhooks: vi.fn(),
  createBotTeamWebhook: vi.fn(),
  replaceBotTeamWebhookSecret: vi.fn()
}))
const writeClipboardText = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client-webhooks', () => client)
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const { BotTeamWebhook } = await import('./BotTeamWebhook')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'mk',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    { ...BOT, id: 'nora', name: 'Nora', job: 'Writes the copy', agent: 'claude' },
    { ...BOT, id: 'iris', name: 'Iris', job: 'Designs flyers', agent: 'codex' }
  ]
}
const HOOK = { id: 'h1', teamId: 'mk', botId: 'nora', lastCall: null }
const OFF = { state: 'unavailable' as const }

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount(webhookId?: string, listed: unknown = { webhooks: [], endpoint: OFF }) {
  client.listBotTeamWebhooks.mockResolvedValue(listed)
  Object.defineProperty(window, 'api', {
    value: { ui: { writeClipboardText } },
    configurable: true
  })
  writeClipboardText.mockResolvedValue(undefined)
  const onBack = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamWebhook team={TEAM} {...(webhookId ? { webhookId } : {})} onBack={onBack} />
    )
  )
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name)
  return { container, button, onBack, root }
}

describe('Start a task from another app', () => {
  it('makes an address for the chosen bot and shows the key once, with a way to copy it', async () => {
    client.createBotTeamWebhook.mockResolvedValue({
      webhook: { ...HOOK, botId: 'iris' },
      secret: 'whsec_TESTSECRET',
      endpoint: OFF
    })
    const { container, button, onBack } = await mount()
    act(() => button('Iris')?.click())
    await act(async () => button('Create web address')?.click())
    expect(client.createBotTeamWebhook).toHaveBeenCalledWith({ teamId: 'mk', botId: 'iris' })
    const text = container.textContent ?? ''
    expect(text).toContain('/hooks/marketing/h1')
    expect(text).toContain('whsec_TESTSECRET')
    expect(text).toContain(
      "Shown once. Copy it now and keep it somewhere safe. You won't see it again."
    )
    expect(text).toContain('One task in Marketing’s board, in progress, with its own thread')
    await act(async () => button('Copy key')?.click())
    expect(writeClipboardText).toHaveBeenCalledWith('whsec_TESTSECRET')
    await act(async () => button('Copy')?.click())
    expect(writeClipboardText).toHaveBeenLastCalledWith('/hooks/marketing/h1')
    act(() => button('Done')?.click())
    expect(onBack).toHaveBeenCalled()
  })

  it('says plainly that this host does not take calls yet', async () => {
    const { container } = await mount()
    expect(container.textContent).toContain('This host does not take calls yet')
    const ready = await mount('h1', {
      webhooks: [HOOK],
      endpoint: { state: 'ready', baseUrl: 'https://host.example' }
    })
    expect(ready.container.textContent).not.toContain('does not take calls yet')
    expect(ready.container.textContent).toContain('https://host.example/hooks/marketing/h1')
  })

  it('never shows the key of an address that already exists', async () => {
    const { container } = await mount('h1', { webhooks: [HOOK], endpoint: OFF })
    expect(container.textContent).toContain('The key is hidden')
    expect(container.textContent).not.toContain('whsec_')
    expect(container.textContent).not.toContain('Shown once')
  })

  it('replaces the key only after asking, and shows the new one once', async () => {
    client.replaceBotTeamWebhookSecret.mockResolvedValue({
      webhook: HOOK,
      secret: 'whsec_NEWSECRET',
      endpoint: OFF
    })
    const { container, button } = await mount('h1', { webhooks: [HOOK], endpoint: OFF })
    act(() => button('Replace key')?.click())
    expect(client.replaceBotTeamWebhookSecret).not.toHaveBeenCalled()
    expect(container.textContent).toContain('The old key stops working at once.')
    await act(async () => button('Replace key')?.click())
    expect(client.replaceBotTeamWebhookSecret).toHaveBeenCalledWith('h1')
    expect(container.textContent).toContain('whsec_NEWSECRET')
  })

  it('does not replace the key when the person backs out', async () => {
    const { container, button } = await mount('h1', { webhooks: [HOOK], endpoint: OFF })
    act(() => button('Replace key')?.click())
    act(() => button('Cancel')?.click())
    expect(client.replaceBotTeamWebhookSecret).not.toHaveBeenCalled()
    expect(container.textContent).toContain('The key is hidden')
  })

  it('keeps the form and says why when the host refuses', async () => {
    client.createBotTeamWebhook.mockRejectedValue(new Error('Bot nora is not on team mk.'))
    const { button } = await mount()
    await act(async () => button('Create web address')?.click())
    expect(toasts.error).toHaveBeenCalledWith('Bot nora is not on team mk.')
    expect(button('Create web address')).toBeDefined()
  })

  it('forgets the key once the page is left', async () => {
    client.createBotTeamWebhook.mockResolvedValue({
      webhook: HOOK,
      secret: 'whsec_TESTSECRET',
      endpoint: OFF
    })
    const first = await mount()
    await act(async () => first.button('Create web address')?.click())
    expect(first.container.textContent).toContain('whsec_TESTSECRET')
    act(() => first.root.unmount())
    const again = await mount('h1', { webhooks: [HOOK], endpoint: OFF })
    expect(again.container.textContent).not.toContain('whsec_TESTSECRET')
  })
})
