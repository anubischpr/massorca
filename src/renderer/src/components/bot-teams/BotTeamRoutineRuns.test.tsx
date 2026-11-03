/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun
} from '../../../../shared/rpc-contract/bot-team-routine-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  listBotTeamRoutines: vi.fn(),
  listBotTeamRoutineRuns: vi.fn(),
  setBotTeamRoutinePaused: vi.fn()
}))
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const statuses = vi.hoisted(() => ({ current: new Map() }))
vi.mock('@/runtime/runtime-bot-team-client-routines', () => client)
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeamRoom }))
vi.mock('@/runtime/bot-team-host', () => ({ useBotTeamHost: () => 'local' }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ runtimeEnvironments: [] })
}))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => statuses.current }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('@/components/sidebar/StatusIndicator', () => ({
  default: ({ status }: { status: string }) => <i data-glyph={status} />
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { BotTeamRoutineRuns } = await import('./BotTeamRoutineRuns')

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
const ROUTINE: BotTeamRoutine = {
  id: 'r1',
  teamId: 'mk',
  botId: 'nora',
  name: 'Monday check-in',
  prompt: 'List what is open.',
  schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
  paused: false,
  nextRun: { date: '2026-11-09', time: '09:00' },
  lastRun: null
}
const run = (
  id: string,
  taskId: string | null,
  error: string | null = null
): BotTeamRoutineRun => ({
  id,
  routineId: 'r1',
  scheduledFor: { date: '2026-11-02', time: '09:00' },
  taskId,
  error
})

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
  statuses.current = new Map()
})

async function mount(runs: BotTeamRoutineRun[] | 'unavailable') {
  client.listBotTeamRoutines.mockResolvedValue([ROUTINE])
  client.listBotTeamRoutineRuns.mockResolvedValue(runs)
  const task = (id: string, sessionId: string | null) => ({
    id,
    teamId: 'mk',
    title: 'Monday check-in',
    prompt: '',
    ownerBotId: 'nora',
    sessionId,
    projectId: null
  })
  listBotTeamRoom.mockResolvedValue({
    tasks: [task('t1', 's1'), task('t2', null)],
    messages: [],
    projects: []
  })
  statuses.current = new Map([['s1', { status: 'idle', turnOutcome: 'success' }]])
  const onBack = vi.fn()
  const onOpenTask = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamRoutineRuns team={TEAM} routineId="r1" onBack={onBack} onOpenTask={onOpenTask} />
    )
  )
  const buttons = (name: string): HTMLButtonElement[] =>
    [...container.querySelectorAll('button')].filter((entry) => entry.textContent?.trim() === name)
  return { container, buttons, onBack, onOpenTask }
}

describe('Routine runs', () => {
  it('shows how the routine runs: when, bot, access and next run', async () => {
    const { container } = await mount([])
    const text = container.textContent ?? ''
    expect(text).toContain('Monday check-in')
    expect(text).toContain('List what is open.')
    expect(text).toContain('Every Monday at 09:00')
    expect(text).toContain('Nora')
    expect(text).toContain('Full access, set for Marketing')
    expect(text).toMatch(/Next run.*09:00/)
    expect(text).toContain('Each run creates one task in Marketing’s board.')
    expect(text).toContain('It has not run yet.')
  })

  it('lists each run with the state of its task and a way to open it', async () => {
    const { container, buttons, onOpenTask } = await mount([run('a', 't1'), run('b', 't2')])
    const text = container.textContent ?? ''
    expect(text).toContain('Done')
    expect(text).toContain('Not started')
    expect(text).toContain('Made the task “Monday check-in”.')
    const [first, second] = buttons('Open task')
    act(() => first.click())
    expect(onOpenTask).toHaveBeenCalledWith('t1')
    act(() => second.click())
    expect(onOpenTask).toHaveBeenLastCalledWith('t2')
  })

  it('says why a run did not start, with no task to open', async () => {
    const { container, buttons } = await mount([
      run('a', null, 'The routine’s bot is no longer on the team.')
    ])
    expect(container.textContent).toContain('Did not start')
    expect(container.textContent).toContain('The routine’s bot is no longer on the team.')
    expect(buttons('Open task')).toHaveLength(0)
  })

  it('pauses from the bar and goes back to the routines', async () => {
    client.setBotTeamRoutinePaused.mockResolvedValue({ ...ROUTINE, paused: true, nextRun: null })
    const { container, buttons, onBack } = await mount([])
    await act(async () => buttons('Paused')[0]?.click())
    expect(client.setBotTeamRoutinePaused).toHaveBeenCalledWith('r1', true)
    expect(container.textContent).toContain('Paused.')
    act(() => buttons('Routines')[0]?.click())
    expect(onBack).toHaveBeenCalled()
  })

  it('says so when the host cannot list runs', async () => {
    const { container } = await mount('unavailable')
    expect(container.textContent).toContain('This host cannot run routines yet.')
  })
})
