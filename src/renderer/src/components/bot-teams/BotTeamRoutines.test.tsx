/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoutine } from '../../../../shared/rpc-contract/bot-team-routine-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  listBotTeamRoutines: vi.fn(),
  setBotTeamRoutinePaused: vi.fn(),
  deleteBotTeamRoutine: vi.fn()
}))
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const statuses = vi.hoisted(() => ({ current: new Map() }))
vi.mock('@/runtime/runtime-bot-team-client-routines', () => client)
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeamRoom }))
vi.mock('@/runtime/bot-team-host', () => ({ useBotTeamHost: () => 'pv-vps' }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) =>
    select({ runtimeEnvironments: [{ id: 'pv-vps', name: 'pv-vps' }] })
}))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => statuses.current }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
const toasts = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const { BotTeamRoutines } = await import('./BotTeamRoutines')

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

function routine(overrides: Partial<BotTeamRoutine> = {}): BotTeamRoutine {
  return {
    id: 'r1',
    teamId: 'mk',
    botId: 'nora',
    name: 'Monday check-in',
    prompt: 'List what is open.',
    schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
    paused: false,
    nextRun: { date: '2026-11-09', time: '09:00' },
    lastRun: { scheduledFor: { date: '2026-11-02', time: '09:00' }, taskId: 't1', error: null },
    ...overrides
  }
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount(listed: BotTeamRoutine[] | 'unavailable', extras = {}) {
  client.listBotTeamRoutines.mockResolvedValue(listed)
  listBotTeamRoom.mockResolvedValue({
    tasks: [
      {
        id: 't1',
        teamId: 'mk',
        title: 'Monday check-in',
        prompt: '',
        ownerBotId: 'nora',
        sessionId: null,
        projectId: null
      }
    ],
    messages: [],
    projects: []
  })
  const onNew = vi.fn()
  const onOpen = vi.fn()
  const onEdit = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamRoutines team={TEAM} onNew={onNew} onOpen={onOpen} onEdit={onEdit} {...extras} />
    )
  )
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name)
  return { container, button, onNew, onOpen, onEdit }
}

describe('Routines', () => {
  it('lists each routine with when it runs, its bot, its access and its last and next run', async () => {
    const { container } = await mount([routine()])
    const text = container.textContent ?? ''
    expect(text).toContain('Monday check-in')
    expect(text).toContain('Every Monday at 09:00, Nora, full access')
    expect(text).toMatch(/Last run .+, not started\. Next run .+, 09:00\./)
    expect(text).toContain('Runs on pv-vps, the host Marketing uses.')
    expect(text).toContain(
      'A routine starts a task on a schedule. Each run is kept in its history.'
    )
  })

  it('says a routine has not run yet, and a paused one is paused', async () => {
    const { container } = await mount([
      routine({ lastRun: null }),
      routine({ id: 'r2', name: 'Price list', paused: true, nextRun: null })
    ])
    expect(container.textContent).toContain('Not run yet. Next run')
    expect(container.textContent).toContain('Paused.')
  })

  it('shows a one-time routine with its date, and as done or past once its moment is gone', async () => {
    const once = { frequency: 'once', time: '10:00', weekday: null, monthDay: null } as const
    const { container } = await mount([
      routine({ name: 'Front review', schedule: { ...once, date: '2026-11-04' }, lastRun: null }),
      routine({
        id: 'r2',
        name: 'Copy review',
        schedule: { ...once, date: '2026-11-02' },
        nextRun: null
      }),
      routine({
        id: 'r3',
        name: 'Missed',
        schedule: { ...once, date: '2026-11-01' },
        nextRun: null,
        lastRun: null
      })
    ])
    const archive = [...container.querySelectorAll('button')].find((entry) =>
      entry.textContent?.startsWith('Archived')
    )
    act(() => archive?.click())
    const text = container.textContent ?? ''
    expect(text).toMatch(/Once on .+ at 10:00, Nora/)
    expect(text).toContain('Not run yet. Next run')
    expect(text).toMatch(/Done\. Ran .+, not started\./)
    expect(text).toContain('Past. It did not run.')
  })

  it('opens a routine and starts a new one', async () => {
    const { button, onNew, onOpen, container } = await mount([routine()])
    const row = [...container.querySelectorAll('button')].find((entry) =>
      entry.textContent?.includes('Monday check-in')
    )
    act(() => row?.click())
    expect(onOpen).toHaveBeenCalledWith('r1')
    act(() => button('New routine')?.click())
    expect(onNew).toHaveBeenCalled()
  })

  it('pauses a routine from its switch, and keeps it listed', async () => {
    const paused = routine({ paused: true, nextRun: null })
    client.setBotTeamRoutinePaused.mockResolvedValue(paused)
    const { button, container } = await mount([routine()])
    await act(async () => button('Paused')?.click())
    expect(client.setBotTeamRoutinePaused).toHaveBeenCalledWith('r1', true)
    expect(container.textContent).toContain('Monday check-in')
    expect(container.textContent).toContain('Paused.')
  })

  it('shows the empty state with a way to add the first routine', async () => {
    const { container, button, onNew } = await mount([])
    expect(container.textContent).toContain('No routines yet')
    expect(container.textContent).toContain(
      'A routine starts a task on a schedule, with one bot in Marketing. Each run is kept in its history.'
    )
    act(() => button('New routine')?.click())
    expect(onNew).toHaveBeenCalled()
  })

  it('says so when the host cannot run routines, with no way to add one', async () => {
    const { container, button } = await mount('unavailable')
    expect(container.textContent).toContain('This host cannot run routines yet.')
    expect(button('New routine')).toBeUndefined()
  })

  it('archives a Once routine that ran, in a section closed by default with its count', async () => {
    const once = { frequency: 'once', time: '15:00', weekday: null, monthDay: null } as const
    const { container, button } = await mount([
      routine(),
      routine({
        id: 'r2',
        name: 'Launch flyer',
        schedule: { ...once, date: '2026-11-03' },
        nextRun: null
      })
    ])
    const archive = [...container.querySelectorAll('button')].find((entry) =>
      entry.textContent?.startsWith('Archived')
    )
    expect(archive?.textContent).toBe('Archived1')
    expect(archive?.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain('Launch flyer')
    act(() => archive?.click())
    expect(container.textContent).toContain('Launch flyer')
    // An archived routine has no On and Paused switch: only the active one does.
    expect(
      [...container.querySelectorAll('button')].filter((entry) => entry.textContent === 'Paused')
    ).toHaveLength(1)
    expect(button('Paused')).toBeDefined()
  })

  it('edits a routine from its menu', async () => {
    const { container, onEdit } = await mount([routine()])
    const menu = container.querySelector<HTMLButtonElement>('[aria-label="Routine actions"]')
    act(() => {
      menu?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    })
    const edit = [...document.querySelectorAll('[role="menuitem"]')].find(
      (entry) => entry.textContent === 'Edit'
    )
    act(() => (edit as HTMLElement | undefined)?.click())
    expect(onEdit).toHaveBeenCalledWith('r1')
  })

  it('deletes a routine only after the dialog confirms it', async () => {
    client.deleteBotTeamRoutine.mockResolvedValue(undefined)
    const { container } = await mount([routine()])
    const menu = container.querySelector<HTMLButtonElement>('[aria-label="Routine actions"]')
    act(() => {
      menu?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    })
    const remove = [...document.querySelectorAll('[role="menuitem"]')].find(
      (entry) => entry.textContent === 'Delete'
    )
    act(() => (remove as HTMLElement | undefined)?.click())
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('Delete Monday check-in?')
    expect(client.deleteBotTeamRoutine).not.toHaveBeenCalled()
    const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find(
      (entry) => entry.textContent === 'Delete'
    )
    await act(async () => confirm?.click())
    expect(client.deleteBotTeamRoutine).toHaveBeenCalledWith('r1')
    expect(container.textContent).not.toContain('Monday check-in')
  })

  it('leaves room for the web addresses under the routines', async () => {
    const { container } = await mount([routine()], { webAddresses: <p>Web addresses here</p> })
    expect(container.textContent).toContain('Web addresses here')
  })
})
