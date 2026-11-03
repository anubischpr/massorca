/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const { BotTeamsIntegrations } = await import('./BotTeamsIntegrations')

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamsIntegrations />))
  return container
}

describe('BotTeamsIntegrations', () => {
  it('lists the apps of board 27 under its title and sentence', () => {
    const text = mount().textContent ?? ''
    expect(text).toContain('Integrations')
    expect(text).toContain(
      'Connecting an app does not let bots act on their own. Permissions still apply.'
    )
    for (const app of ['Email', 'Calendar', 'Shared drive', 'CRM']) {
      expect(text).toContain(app)
    }
  })

  it('connects nothing: every Connect is off, and the pane says so', () => {
    const container = mount()
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(button.textContent).toBe('Connect')
      expect(button.disabled).toBe(true)
    }
    expect(container.textContent).toContain('Connecting apps is not available yet.')
  })
})
