/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const reassign = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-routing-client', () => ({ reassignBotTeamTask: reassign }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { BotTeamReassignButton } = await import('./BotTeamReassignButton')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
function team(id: string, name: string, bots: BotTeam['bots']): BotTeam {
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
const TEAMS = [
  team('mk', 'Marketing', [
    { ...BOT, id: 'iris', name: 'Iris', job: 'Designs flyers', agent: 'claude' },
    { ...BOT, id: 'max', name: 'Max', job: 'Writes copy', agent: 'codex' }
  ]),
  team('wh', 'Warehouse', [
    { ...BOT, id: 'bea', name: 'Bea', job: 'Counts stock', agent: 'claude' }
  ])
]
const TASK: BotTeamTask = {
  id: 't1',
  teamId: 'mk',
  title: 'Flyer for June',
  prompt: 'Make it',
  ownerBotId: 'iris',
  sessionId: null,
  projectId: null
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function mount(onDone = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamReassignButton task={TASK} teams={TEAMS} disabled={false} onDone={onDone} />
    )
  )
  const open = container.querySelector('button')
  await act(async () => open?.click())
  return { onDone }
}

const dialog = (): HTMLElement | null => document.body.querySelector('[role="dialog"]')

describe('BotTeamReassignButton', () => {
  it('asks who should own the task, in the board 16 words, listing every other bot with its team', async () => {
    await mount()
    expect(dialog()?.textContent).toContain('Who should own Flyer for June?')
    expect(dialog()?.textContent).toContain(
      'The new owner reads the task so far and continues from there.'
    )
    const rows = [...(dialog()?.querySelectorAll('button[data-bot]') ?? [])].map(
      (row) => row.textContent
    )
    expect(rows).toEqual(['MaxMarketing, Writes copy', 'BeaWarehouse, Counts stock'])
  })

  it('gives the task to the bot that is picked and tells the room', async () => {
    reassign.mockResolvedValue({ task: { id: 't1' }, startError: null })
    const { onDone } = await mount()
    const bea = dialog()?.querySelector<HTMLButtonElement>('button[data-bot="bea"]')
    await act(async () => bea?.click())
    expect(reassign).toHaveBeenCalledWith('t1', 'bea')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
  })

  it('closes without changing anything on Cancel', async () => {
    const { onDone } = await mount()
    const cancel = [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Cancel'
    )
    await act(async () => cancel?.click())
    expect(reassign).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(dialog()).toBeNull()
  })
})
