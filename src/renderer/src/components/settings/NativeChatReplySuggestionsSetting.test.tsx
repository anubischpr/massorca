// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { NativeChatReplySuggestionsSetting } from './NativeChatReplySuggestionsSetting'

const state = vi.hoisted(() => ({ settingsSearchQuery: '' }))
vi.mock('../../store', () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state)
}))

afterEach(cleanup)

function renderSetting(overrides: Partial<GlobalSettings> = {}) {
  const settings = { ...getDefaultSettings('/tmp'), ...overrides }
  const updateSettings = vi.fn()
  render(<NativeChatReplySuggestionsSetting settings={settings} updateSettings={updateSettings} />)
  return { updateSettings }
}

describe('Reply suggestions setting', () => {
  it('defaults both toggles to on', () => {
    renderSetting()
    expect(
      screen.getByRole('switch', { name: 'Toggle reply suggestions' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(
      screen
        .getByRole('switch', { name: 'Toggle suggestions for agents without their own' })
        .getAttribute('aria-checked')
    ).toBe('true')
  })

  it('writes each off preference on its own', () => {
    const { updateSettings } = renderSetting()
    fireEvent.click(
      screen.getByRole('switch', { name: 'Toggle suggestions for agents without their own' })
    )
    expect(updateSettings).toHaveBeenLastCalledWith({ nativeChatEmulatedReplySuggestions: false })
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle reply suggestions' }))
    expect(updateSettings).toHaveBeenLastCalledWith({ nativeChatReplySuggestions: false })
  })

  it('hides the emulated sub-toggle while suggestions are off', () => {
    renderSetting({ nativeChatReplySuggestions: false })
    expect(
      screen.queryByRole('switch', { name: 'Toggle suggestions for agents without their own' })
    ).toBeNull()
  })
})
