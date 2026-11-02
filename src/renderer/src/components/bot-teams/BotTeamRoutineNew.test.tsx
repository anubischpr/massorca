/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const createBotTeamRoutine = vi.hoisted(() => vi.fn())
const openSettingsTarget = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client-routines', () => ({ createBotTeamRoutine }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ openSettingsTarget })
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
const toasts = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const { BotTeamRoutineNew } = await import('./BotTeamRoutineNew')

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

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount() {
  const onBack = vi.fn()
  const onCreated = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamRoutineNew team={TEAM} onBack={onBack} onCreated={onCreated} />)
  )
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name)
  const type = async (selector: string, value: string): Promise<void> => {
    const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
    if (!field) {
      throw new Error(`No field ${selector}`)
    }
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  return { container, button, type, onBack, onCreated }
}

describe('New routine', () => {
  it('keeps Create routine off until it has a name and what to do', async () => {
    const { button, type } = await mount()
    expect(button('Create routine')?.disabled).toBe(true)
    await type('#routine-name', 'Monday check-in')
    expect(button('Create routine')?.disabled).toBe(true)
    await type('#routine-prompt', 'List what is open.')
    expect(button('Create routine')?.disabled).toBe(false)
  })

  it('creates a weekly routine for the chosen bot and goes back to the list', async () => {
    createBotTeamRoutine.mockResolvedValue({})
    const { button, type, onCreated } = await mount()
    await type('#routine-name', ' Monday check-in ')
    await type('#routine-prompt', 'List what is open.')
    act(() => button('Iris')?.click())
    act(() => button('Fri')?.click())
    await act(async () => button('Create routine')?.click())
    expect(createBotTeamRoutine).toHaveBeenCalledWith({
      teamId: 'mk',
      botId: 'iris',
      name: 'Monday check-in',
      prompt: 'List what is open.',
      schedule: { frequency: 'weekly', time: '09:00', weekday: 5, monthDay: null }
    })
    expect(onCreated).toHaveBeenCalled()
  })

  it('sends only the day its frequency uses', async () => {
    createBotTeamRoutine.mockResolvedValue({})
    const { button, type } = await mount()
    await type('#routine-name', 'Prices')
    await type('#routine-prompt', 'Check the prices.')
    act(() => button('Every month')?.click())
    act(() => button('15')?.click())
    await type('input[type="time"]', '16:30')
    await act(async () => button('Create routine')?.click())
    expect(createBotTeamRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: { frequency: 'monthly', time: '16:30', weekday: null, monthDay: 15 }
      })
    )
    act(() => button('Every day')?.click())
    await act(async () => button('Create routine')?.click())
    expect(createBotTeamRoutine).toHaveBeenLastCalledWith(
      expect.objectContaining({
        schedule: { frequency: 'daily', time: '16:30', weekday: null, monthDay: null }
      })
    )
  })

  it('shows the bot job, the access it uses and where to change it', async () => {
    const { container, button } = await mount()
    expect(container.textContent).toContain('Writes the copy')
    expect(container.textContent).toContain('Full access')
    expect(container.textContent).toContain('Set for Marketing in Settings. This routine uses it.')
    expect(container.textContent).toContain(
      'Runs at this time, on the clock of the host Marketing uses.'
    )
    act(() => button('Iris')?.click())
    expect(container.textContent).toContain('Designs flyers')
    act(() => button('Change in Settings')?.click())
    expect(openSettingsTarget).toHaveBeenCalledWith({ pane: 'bot-teams', repoId: null })
  })

  it('keeps the form and says why when the host refuses', async () => {
    createBotTeamRoutine.mockRejectedValue(new Error('Bot x is not on team mk.'))
    const { button, type, onCreated } = await mount()
    await type('#routine-name', 'A')
    await type('#routine-prompt', 'B')
    await act(async () => button('Create routine')?.click())
    expect(toasts.error).toHaveBeenCalledWith('Bot x is not on team mk.')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('cancels back to the list', async () => {
    const { button, onBack } = await mount()
    act(() => button('Cancel')?.click())
    expect(onBack).toHaveBeenCalled()
  })
})
