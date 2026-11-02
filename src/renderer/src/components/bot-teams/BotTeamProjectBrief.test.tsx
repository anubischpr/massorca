/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamRoom = vi.hoisted(() => vi.fn())
const setBotTeamProjectBrief = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom,
  setBotTeamProjectBrief
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]))
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const { BotTeamProjectBrief } = await import('./BotTeamProjectBrief')

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

function project(overrides: Partial<BotTeamProject> = {}): BotTeamProject {
  return {
    id: 'p1',
    teamId: 't1',
    name: 'Summer campaign',
    goal: 'Sell the offers',
    codeSource: null,
    brief: {
      requirements: ['Flyer for the offers', 'Offer email'],
      constraints: ['Prices are checked first'],
      decisions: []
    },
    briefUpdatedAt: null,
    ...overrides
  }
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(onTab = vi.fn(), onBack = vi.fn()): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamProjectBrief team={TEAM} projectId="p1" onBack={onBack} onTab={onTab} />)
  )
  return container
}

function typeInto(textarea: HTMLTextAreaElement | null, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(textarea, value)
  textarea?.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  listBotTeamRoom.mockReset()
  listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project()] })
  setBotTeamProjectBrief.mockReset()
  toastError.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the project brief', () => {
  it('lists Goal, Requirements, Constraints and Decisions with the design’s copy', async () => {
    const container = await mount()
    const text = container.textContent ?? ''
    for (const copy of [
      'Brief',
      'The project holds the why. Each task holds the how. Bots read this brief and their own task thread.',
      'Goal',
      'Sell the offers',
      'Requirements',
      'Flyer for the offers',
      'Offer email',
      'Constraints',
      'Prices are checked first',
      'Decisions'
    ]) {
      expect(text).toContain(copy)
    }
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Goal',
      'Requirements',
      'Constraints',
      'Decisions'
    ])
    expect(text).toContain('Summer campaign')
    expect(text).toContain('Marketing')
  })

  it('says a requirement is not linked while nothing links it', async () => {
    const container = await mount()
    expect(container.textContent?.match(/Not linked yet/g)).toHaveLength(2)
  })

  it('shows the empty requirements text', async () => {
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [project({ brief: { requirements: [], constraints: [], decisions: [] } })]
    })
    const container = await mount()
    expect(container.textContent).toContain('No requirements yet.')
  })

  it('saves a section when the person edits it and leaves it, one line per entry', async () => {
    setBotTeamProjectBrief.mockResolvedValue(project())
    const container = await mount()

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Decisions"]')?.click()
    )
    const textarea = container.querySelector('textarea')
    await act(async () => typeInto(textarea, 'Iris lays out the flyer.\nNora writes the text.\n'))
    await act(async () => {
      textarea?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })

    expect(setBotTeamProjectBrief).toHaveBeenCalledWith('p1', {
      goal: 'Sell the offers',
      brief: {
        requirements: ['Flyer for the offers', 'Offer email'],
        constraints: ['Prices are checked first'],
        decisions: ['Iris lays out the flyer.', 'Nora writes the text.']
      }
    })
  })

  it('saves the goal as text', async () => {
    setBotTeamProjectBrief.mockResolvedValue(project())
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Goal"]')?.click()
    )
    const textarea = container.querySelector('textarea')
    await act(async () => typeInto(textarea, 'Sell more'))
    await act(async () => {
      textarea?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(setBotTeamProjectBrief).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ goal: 'Sell more' })
    )
  })

  it('does not save when nothing changed', async () => {
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Constraints"]')?.click()
    )
    await act(async () => {
      container
        .querySelector('textarea')
        ?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(setBotTeamProjectBrief).not.toHaveBeenCalled()
  })

  it('tells the person when the host is too old to keep a brief', async () => {
    setBotTeamProjectBrief.mockResolvedValue('unavailable')
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Goal"]')?.click()
    )
    const textarea = container.querySelector('textarea')
    await act(async () => typeInto(textarea, 'Sell more'))
    await act(async () => {
      textarea?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(toastError).toHaveBeenCalledWith('This host cannot keep a project brief yet.')
  })

  it('shows when it was updated, only once it has been', async () => {
    const container = await mount()
    expect(container.textContent).not.toContain('Updated')
    act(() => {
      for (const { root } of mounted.splice(0)) {
        root.unmount()
      }
    })
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [project({ briefUpdatedAt: Date.UTC(2026, 10, 1, 12, 0) })]
    })
    const again = await mount()
    expect(again.textContent).toMatch(/Updated .+ by you\./)
  })

  it('goes back to the Board and switches tabs', async () => {
    const onTab = vi.fn()
    const onBack = vi.fn()
    const container = await mount(onTab, onBack)
    const buttons = [...container.querySelectorAll('button')]
    act(() =>
      buttons
        .find((b) => b.textContent?.trim() === 'Board' && !b.closest('[role="radiogroup"]'))
        ?.click()
    )
    expect(onBack).toHaveBeenCalled()
    const tab = [...container.querySelectorAll('[role="radiogroup"] button')].find(
      (b) => b.textContent?.trim() === 'Board'
    )
    await act(async () => tab?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onTab).toHaveBeenCalledWith('board')
  })
})
