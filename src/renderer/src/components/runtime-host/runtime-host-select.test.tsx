/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotTeamHostPicker } from '../bot-teams/BotTeamHostPicker'
import { BOT_TEAM_LOCAL_HOST, useBotTeamHostStore } from '@/runtime/bot-team-host'

const storeBox = vi.hoisted((): { state: Record<string, unknown> } => ({ state: {} }))

vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (state: unknown) => unknown) => selector(storeBox.state), {
    getState: () => storeBox.state
  })
}))

const PAIRED_SERVER = { id: 'env-vps', name: 'VPS Alpha' }

function chooseOption(name: string): void {
  const option = screen.getAllByRole('option').find((entry) => entry.textContent?.includes(name))
  if (!option) {
    throw new Error(`Option ${name} missing`)
  }
  act(() => {
    option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
  })
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  window.localStorage.clear()
  useBotTeamHostStore.setState({ chosen: null })
  storeBox.state = {
    runtimeEnvironments: [PAIRED_SERVER],
    runtimeStatusByEnvironmentId: new Map(),
    settings: { activeRuntimeEnvironmentId: null }
  }
})

afterEach(() => {
  cleanup()
})

describe('Bot teams host select', () => {
  it('lists paired servers first, then This computer, and saves the choice', () => {
    render(<BotTeamHostPicker />)

    const trigger = screen.getByRole('combobox', { name: 'Host' })
    expect(trigger.textContent).toContain('VPS Alpha')

    act(() => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })
      )
    })
    const labels = screen.getAllByRole('option').map((entry) => entry.textContent ?? '')
    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain('VPS Alpha')
    expect(labels[1]).toContain('This computer')
    expect(labels[1]).toContain('Here')

    chooseOption('This computer')

    expect(useBotTeamHostStore.getState().chosen).toBe(BOT_TEAM_LOCAL_HOST)
    expect(window.localStorage.getItem('massorca.botTeams.host')).toBe(BOT_TEAM_LOCAL_HOST)
  })

  it('renders nothing without a paired server', () => {
    storeBox.state = {
      runtimeEnvironments: [],
      runtimeStatusByEnvironmentId: new Map(),
      settings: { activeRuntimeEnvironmentId: null }
    }

    const { container } = render(<BotTeamHostPicker />)

    expect(container.innerHTML).toBe('')
  })
})
