/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Automation } from '../../../../shared/automations-types'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { CalendarRun } from './calendar-types'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const local = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()
// Saturday, Oct 31 2026 at 2:24 PM, as on the canvas boards.
const NOW = local(2026, 10, 31, 14, 24)

const loadBotRuns = vi.hoisted(() => vi.fn())
const listAutomations = vi.hoisted(() => vi.fn())
const teams = vi.hoisted((): { current: BotTeam[] | null } => ({ current: null }))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? ''),
  getIntlLocale: () => 'en-US'
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: () => null
}))
vi.mock('@/lib/agent-catalog', () => ({
  getAgentDisplayLabel: (agent: string) => (agent === 'claude' ? 'Claude' : agent)
}))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'unknown' }))
vi.mock('../bot-teams/use-bot-teams', () => ({ useBotTeams: () => ({ teams: teams.current }) }))
vi.mock('../bot-teams/BotTeamCharacterIcon', () => ({
  BotTeamCharacterIcon: ({ character }: { character: string }) => <i data-character={character} />
}))
vi.mock('./calendar-bot-runs-source', () => ({ loadBotRuns }))
vi.mock('../automations/automation-host-client', () => ({
  getAutomationListTarget: () => ({ kind: 'local' }),
  listAutomationsForTarget: listAutomations
}))

const { createTestStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { default: CalendarPage } = await import('./CalendarPage')

const marketing: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

function botRun(name: string, at: number): CalendarRun {
  return {
    id: `bot:${name}:${at}`,
    name,
    at,
    frequency: 'daily',
    source: 'bot',
    botName: 'Nora',
    teamId: 't1',
    teamName: 'Marketing'
  }
}

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the calendar reads only these fields.
const triage = {
  id: 'a1',
  name: 'Nightly triage',
  agentId: 'claude',
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  dtstart: local(2026, 1, 1),
  enabled: true
} as Automation

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<CalendarPage initialNow={NOW} />))
  await settle()
  return container
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {})
  }
}

const plain = (text: string | null | undefined): string => (text ?? '').replace(/\s/g, ' ')
const title = (c: ParentNode): string => plain(c.querySelector('h2')?.textContent)

function button(c: ParentNode, label: string): HTMLButtonElement {
  const found = [...c.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent === label
  )
  if (!found) {
    throw new Error(`No button ${label}`)
  }
  return found
}

async function click(c: ParentNode, label: string): Promise<void> {
  await act(async () => button(c, label).click())
  await settle()
}

beforeEach(() => {
  teams.current = [marketing]
  listAutomations.mockReset().mockResolvedValue([triage])
  loadBotRuns
    .mockReset()
    .mockImplementation(
      async ({ from, to }: { from: number; to: number }, options?: { includePast?: boolean }) =>
        [
          botRun('Launch brief', local(2026, 10, 31, 15, 0)),
          botRun('Competitor scan', local(2026, 11, 1, 8, 30)),
          // Only the done-run filter asks for runs that already started.
          ...(options?.includePast === true
            ? [botRun('Morning sync', local(2026, 10, 31, 8, 0))]
            : [])
        ].filter((run) => run.at >= from && run.at < to)
    )
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the Calendar page', () => {
  it('opens on Week with seven day columns, today outlined, and run chips', async () => {
    const c = await mount()
    expect(c.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Calendar view')
    expect(button(c, 'Week').getAttribute('aria-checked')).toBe('true')
    expect(title(c)).toBe('Oct 26 – Nov 1, 2026')
    const days = [...c.querySelectorAll('[data-calendar-day]')]
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.getAttribute('data-today'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
      'true',
      'false'
    ])
    const saturday = days[5]
    expect(plain(saturday.textContent)).toContain('Sat31')
    expect(plain(saturday.textContent)).toContain('3:00 PMLaunch briefNora · Marketing')
    expect(plain(saturday.textContent)).not.toContain('9:00 AMNightly triageClaude · Automations')
    expect(saturday.querySelector('[data-character="square"]')).not.toBeNull()
    // At 2:24 PM the 9:00 AM run is done and hidden by default; Launch brief is still to come.
    const dots = [...saturday.querySelectorAll('[data-past]')].map((d) =>
      d.getAttribute('data-past')
    )
    expect(dots).toEqual(['false'])
  })

  it('moves the range with Previous, Next and Today', async () => {
    const c = await mount()
    await click(c, 'Next')
    expect(title(c)).toBe('Nov 2 – 8, 2026')
    await click(c, 'Previous')
    await click(c, 'Previous')
    expect(title(c)).toBe('Oct 19 – 25, 2026')
    await click(c, 'Today')
    expect(title(c)).toBe('Oct 26 – Nov 1, 2026')
  })

  it('switches to Day rows and to the Month grid', async () => {
    const c = await mount()
    await click(c, 'Day')
    expect(button(c, 'Day').getAttribute('aria-checked')).toBe('true')
    expect(title(c)).toBe('Saturday, Oct 31, 2026')
    expect(plain(c.textContent)).toContain('2:00 PM3:00 PMLaunch brief')
    await click(c, 'Next')
    expect(title(c)).toBe('Sunday, Nov 1, 2026')
    await click(c, 'Month')
    expect(title(c)).toBe('November 2026')
    await click(c, 'Previous')
    expect(title(c)).toBe('October 2026')
    expect(c.querySelectorAll('[data-calendar-day]')).toHaveLength(35)
    expect(c.querySelectorAll('[data-out="true"]')).toHaveLength(4)
  })

  it('lists the teams and Automations in the legend', async () => {
    const c = await mount()
    const legend = c.querySelector('[aria-label="Teams"]')
    expect(plain(legend?.textContent)).toBe('MarketingAutomations')
  })

  it('shows Upcoming runs below Day and Week, never Month', async () => {
    const c = await mount()
    expect(c.textContent).toContain('Upcoming runs')
    expect(plain(c.textContent)).toContain('Today at 3:00 PM · Daily · Nora · Marketing')
    expect(plain(c.textContent)).toContain('Tomorrow at 8:30 AM · Daily · Nora · Marketing')
    expect(plain(c.textContent)).toContain('Tomorrow at 9:00 AM · Daily · Claude · Automations')
    await click(c, 'Month')
    expect(c.textContent).not.toContain('Upcoming runs')
    await click(c, 'Day')
    expect(c.textContent).toContain('Upcoming runs')
  })

  it('shows automations alone while bot runs are unavailable, and hides empty Upcoming runs', async () => {
    loadBotRuns.mockResolvedValue('unavailable')
    teams.current = null
    const c = await mount()
    expect(c.textContent).toContain('Nightly triage')
    expect(c.textContent).not.toContain('Launch brief')
    listAutomations.mockResolvedValue([])
    await act(async () => window.dispatchEvent(new Event('orca:automations-changed')))
    await settle()
    expect(c.querySelectorAll('[data-calendar-run]')).toHaveLength(0)
    expect(c.querySelectorAll('[data-calendar-day]')).toHaveLength(7)
    expect(c.textContent).not.toContain('Upcoming runs')
  })
})

describe('the Calendar page as a run starts', () => {
  afterEach(() => {
    for (const { container, root } of mounted.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    vi.useRealTimers()
  })

  it('takes a bot run off the grid and Upcoming runs together when it starts', async () => {
    vi.useFakeTimers({ now: NOW })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    await act(async () => root.render(<CalendarPage />))
    await settle()
    expect(container.textContent).toContain('Launch brief')
    // Launch brief starts at 3:00 PM, 36 minutes after NOW.
    await act(async () => {
      vi.advanceTimersByTime(36 * 60 * 1000 + 1000)
    })
    await settle()
    expect(container.textContent).not.toContain('Launch brief')
    expect(container.textContent).toContain('Competitor scan')
  })
})

describe('the done-run filter', () => {
  let uiSet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    uiSet = vi.fn(() => Promise.resolve())
    Object.defineProperty(window, 'api', { value: { ui: { set: uiSet } }, configurable: true })
  })

  afterEach(() => {
    for (const { container, root } of mounted.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    vi.useRealTimers()
    store.setState({ calendarShowDoneRuns: false })
    Reflect.deleteProperty(window, 'api')
  })

  async function toggleDoneRuns(c: ParentNode): Promise<void> {
    const control = c.querySelector<HTMLButtonElement>('[role="switch"]')
    if (!control) {
      throw new Error('No done-run switch')
    }
    await act(async () => control.click())
    await settle()
  }

  function chipFor(c: ParentNode, name: string): Element | undefined {
    return [...c.querySelectorAll('[data-calendar-run]')].find((el) =>
      el.textContent?.includes(name)
    )
  }

  it('hides done runs by default, and shows a finished bot run greyed once the filter is on', async () => {
    const c = await mount()
    expect(c.textContent).not.toContain('Morning sync')
    await toggleDoneRuns(c)
    expect(c.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
    expect(uiSet).toHaveBeenCalledWith({ calendarShowDoneRuns: true })
    expect(
      chipFor(c, 'Morning sync')?.querySelector('[data-past]')?.getAttribute('data-past')
    ).toBe('true')
  })

  it('keeps the choice when the page is shown again', async () => {
    await toggleDoneRuns(await mount())
    for (const { container, root } of mounted.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    const again = await mount()
    expect(again.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
    expect(chipFor(again, 'Morning sync')).toBeDefined()
  })

  it('with done runs shown, a run that starts turns grey in the grid and leaves Upcoming', async () => {
    vi.useFakeTimers({ now: NOW })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    await act(async () => root.render(<CalendarPage />))
    await settle()
    await toggleDoneRuns(container)
    // Launch brief starts at 3:00 PM, 36 minutes after NOW.
    await act(async () => {
      vi.advanceTimersByTime(36 * 60 * 1000 + 1000)
    })
    await settle()
    expect(
      chipFor(container, 'Launch brief')?.querySelector('[data-past]')?.getAttribute('data-past')
    ).toBe('true')
    expect(container.textContent).not.toContain('Today at 3:00 PM')
  })
})
