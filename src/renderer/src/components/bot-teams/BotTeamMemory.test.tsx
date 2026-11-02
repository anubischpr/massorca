/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamMemoryEntry } from '../../../../shared/rpc-contract/bot-team-memory-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({ listBotTeamMemory: vi.fn(), deleteBotTeamMemory: vi.fn() }))
vi.mock('@/runtime/runtime-bot-team-memory-client', () => client)
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const { BotTeamMemory } = await import('./BotTeamMemory')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'mk',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    { ...BOT, id: 'iris', name: 'Iris', job: 'Designs', agent: 'claude' },
    { ...BOT, id: 'nora', name: 'Nora', job: 'Writes', agent: 'claude' }
  ]
}
function entry(
  id: string,
  botId: string | null,
  text: string,
  source: BotTeamMemoryEntry['source']
): BotTeamMemoryEntry {
  return { id, teamId: 'mk', botId, text, source }
}
const LINES = [
  entry('1', null, 'Offices are closed on Monday.', { kind: 'task', taskTitle: 'Flyer for June' }),
  entry('2', null, 'Nora checks prices first.', { kind: 'person', taskTitle: null }),
  entry('3', 'iris', 'Large photo at the top.', { kind: 'task', taskTitle: 'Flyer for June' }),
  entry('4', 'nora', 'Short sentences.', { kind: 'person', taskTitle: null })
]

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount(listed: BotTeamMemoryEntry[] | 'unavailable' = LINES) {
  client.listBotTeamMemory.mockResolvedValue(listed)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamMemory team={TEAM} />))
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent === name)
  return { container, button }
}

describe('BotTeamMemory', () => {
  it('shows what the team remembers, in the board 24 words, with where each line came from', async () => {
    const { container } = await mount()
    const text = container.textContent ?? ''
    expect(text).toContain('What the team remembers')
    expect(text).toContain(
      'All bots in this team can use this. Delete anything you want them to forget.'
    )
    expect(text).toContain('Offices are closed on Monday.')
    expect(text).toContain('From the Flyer for June task')
    expect(text).toContain('You told the team')
    expect(text).not.toContain('Large photo at the top.')
  })

  it("shows one bot's memory in its tab, and who told it", async () => {
    const { container, button } = await mount()
    await act(async () => button('Nora')?.click())
    const text = container.textContent ?? ''
    expect(text).toContain('What Nora remembers')
    expect(text).toContain('Only Nora uses this. Delete anything you want Nora to forget.')
    expect(text).toContain('Short sentences.')
    expect(text).toContain('You told Nora')
    expect(text).not.toContain('Offices are closed')
  })

  it('deletes a line for good when the person asks', async () => {
    client.deleteBotTeamMemory.mockResolvedValue(undefined)
    const { container, button } = await mount()
    await act(async () => button('Delete')?.click())
    expect(client.deleteBotTeamMemory).toHaveBeenCalledWith('1')
    expect(container.textContent).not.toContain('Offices are closed on Monday.')
    expect(container.textContent).toContain('Nora checks prices first.')
    expect(toasts.success).toHaveBeenCalledWith('Deleted from memory')
  })

  it('keeps the line and says so when the host could not delete it', async () => {
    client.deleteBotTeamMemory.mockRejectedValue(new Error('No contact'))
    const { container, button } = await mount()
    await act(async () => button('Delete')?.click())
    expect(container.textContent).toContain('Offices are closed on Monday.')
    expect(toasts.error).toHaveBeenCalledWith('No contact')
  })

  it('says there is nothing remembered, and when the host cannot show memory', async () => {
    const empty = await mount([])
    expect(empty.container.textContent).toContain('Nothing remembered here.')
    const old = await mount('unavailable')
    expect(old.container.textContent).toContain(
      'This host cannot show what the team remembers yet.'
    )
  })
})
