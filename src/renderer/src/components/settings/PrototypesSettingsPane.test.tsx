// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import { PrototypesSettingsPane } from './PrototypesSettingsPane'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const LINE_TWO =
  'Produce 2 distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'

function renderPane(prototypeCount: PrototypeCountSetting | undefined) {
  const updateSettings = vi.fn(async () => {})
  const defaults = getDefaultSettings('/tmp')
  const settings = prototypeCount
    ? { ...defaults, prototypeCount }
    : // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: an old profile can lack the field; the pane must read it as the default.
      ({ ...defaults, prototypeCount: undefined } as unknown as typeof defaults)
  render(<PrototypesSettingsPane settings={settings} updateSettings={updateSettings} />)
  return { updateSettings }
}

describe('PrototypesSettingsPane', () => {
  afterEach(cleanup)

  it('shows the two modes, with "Always make 2" selected for a profile without the setting', () => {
    renderPane(undefined)
    expect(screen.getByRole('group', { name: 'Alternatives per request' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Always make/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Ask each time/ })).not.toBeChecked()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('directions (default 2, max 4)')).toBeInTheDocument()
    expect(
      screen.getByText('A card in the chat asks 1, 2 or 3 before the agent starts.')
    ).toBeInTheDocument()
  })

  it('shows the exact line the instruction starts with, for the current count', () => {
    renderPane({ mode: 'always', count: 2 })
    expect(screen.getByText('What MassOrca adds to your prompt')).toBeInTheDocument()
    expect(screen.getByText(LINE_TWO)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Works the same for Claude, Codex, Antigravity and Gentle Shell: it is plain text in the message. The results are grouped as one set per request.'
      )
    ).toBeInTheDocument()
  })

  it('uses the singular line for one direction', () => {
    renderPane({ mode: 'always', count: 1 })
    expect(
      screen.getByText(
        'Produce 1 design direction, as a self-contained HTML file, with a one-line tradeoff.'
      )
    ).toBeInTheDocument()
  })

  it('shows N instead of a number while each request asks', () => {
    renderPane({ mode: 'ask', count: 3 })
    expect(screen.getByRole('radio', { name: /Ask each time/ })).toBeChecked()
    expect(
      screen.getByText(
        'Produce N distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'
      )
    ).toBeInTheDocument()
  })

  it('steps the count with the plus and minus buttons, keeping the mode', async () => {
    const { updateSettings } = renderPane({ mode: 'ask', count: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(updateSettings).toHaveBeenLastCalledWith({ prototypeCount: { mode: 'ask', count: 3 } })
    await userEvent.click(screen.getByRole('button', { name: 'Fewer' }))
    expect(updateSettings).toHaveBeenLastCalledWith({ prototypeCount: { mode: 'ask', count: 1 } })
  })

  it('stops at 1 and at 4', async () => {
    const { updateSettings } = renderPane({ mode: 'always', count: 4 })
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(updateSettings).not.toHaveBeenCalled()
    cleanup()
    renderPane({ mode: 'always', count: 1 })
    expect(screen.getByRole('button', { name: 'Fewer' })).toBeDisabled()
  })

  it('switches the mode and keeps the count', async () => {
    const { updateSettings } = renderPane({ mode: 'always', count: 3 })
    await userEvent.click(screen.getByRole('radio', { name: /Ask each time/ }))
    expect(updateSettings).toHaveBeenLastCalledWith({ prototypeCount: { mode: 'ask', count: 3 } })
  })
})
