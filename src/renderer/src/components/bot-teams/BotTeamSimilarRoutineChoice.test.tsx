/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))

const routines = vi.hoisted(() => ({
  listBotTeamRoutines: vi.fn(),
  createBotTeamRoutine: vi.fn(),
  updateBotTeamRoutine: vi.fn()
}))
vi.mock('@/runtime/runtime-bot-team-client-routines', () => routines)

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { BotTeamSimilarRoutineChoice } = await import('./BotTeamSimilarRoutineChoice')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'web',
  name: 'Web',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [{ ...BOT, id: 'ana', name: 'Ana', job: 'Front-end developer', agent: 'claude' }]
}

type SimilarChoice = Extract<BotTeamRequestChoice, { kind: 'similar-routine' }>
const CHOICE: SimilarChoice = {
  kind: 'similar-routine',
  routineId: 'routine-1',
  routineName: 'Revisa el front de la web',
  routineNextRun: { date: '2026-11-04', time: '10:00' },
  request: {
    botId: 'ana',
    name: 'Revisa el front, a las 15',
    prompt: 'Revisa el front, a las 15',
    schedule: {
      frequency: 'once',
      time: '15:00',
      weekday: null,
      monthDay: null,
      date: '2026-11-04',
      timeZone: null
    }
  }
}
const ROUTINE = {
  id: 'routine-1',
  teamId: 'web',
  botId: 'ana',
  name: 'Revisa el front de la web',
  prompt: 'Revisa el front de la web',
  schedule: {
    frequency: 'once',
    time: '10:00',
    weekday: null,
    monthDay: null,
    date: '2026-11-04',
    timeZone: null
  },
  paused: false,
  nextRun: { date: '2026-11-04', time: '10:00' },
  nextRunAt: null,
  lastRun: null
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})
beforeEach(() => {
  vi.clearAllMocks()
})

function show(onDone = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(<BotTeamSimilarRoutineChoice choice={CHOICE} team={TEAM} onDone={onDone} />)
  )
  const button = (name: string): HTMLButtonElement => {
    const found = [...container.querySelectorAll('button')].find((b) => b.textContent === name)
    if (!found) {
      throw new Error(`No button ${name}: ${container.textContent}`)
    }
    return found
  }
  return { container, button, onDone }
}

async function click(element: HTMLButtonElement): Promise<void> {
  await act(async () => {
    element.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('a request like a routine the team already runs', () => {
  it('asks whether to reschedule that routine or create a new one', () => {
    const { container, button } = show()
    expect(container.textContent).toContain('Revisa el front de la web')
    expect(button('Reschedule Revisa el front de la web')).toBeDefined()
    expect(button('Create a new one')).toBeDefined()
  })

  it('reschedules that routine to the moment the request names, keeping its name and bot', async () => {
    routines.listBotTeamRoutines.mockResolvedValue([ROUTINE])
    routines.updateBotTeamRoutine.mockResolvedValue(ROUTINE)
    const { button, onDone } = show()
    await click(button('Reschedule Revisa el front de la web'))
    expect(routines.updateBotTeamRoutine).toHaveBeenCalledWith({
      routineId: 'routine-1',
      botId: 'ana',
      name: 'Revisa el front de la web',
      prompt: 'Revisa el front de la web',
      schedule: CHOICE.request.schedule
    })
    expect(routines.createBotTeamRoutine).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('creates the routine the request names, as a routine of its own', async () => {
    routines.createBotTeamRoutine.mockResolvedValue(ROUTINE)
    const { button, onDone } = show()
    await click(button('Create a new one'))
    expect(routines.createBotTeamRoutine).toHaveBeenCalledWith({ teamId: 'web', ...CHOICE.request })
    expect(routines.updateBotTeamRoutine).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('says why an answer failed and keeps the question for another try', async () => {
    routines.createBotTeamRoutine.mockRejectedValue(new Error('The bot is gone.'))
    const { button, onDone } = show()
    await click(button('Create a new one'))
    expect(toast.error).toHaveBeenCalledWith('The bot is gone.')
    expect(onDone).not.toHaveBeenCalled()
  })
})
