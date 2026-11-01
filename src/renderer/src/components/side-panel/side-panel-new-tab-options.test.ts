import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const { buildSidePanelNewTabOptions } = await import('./side-panel-new-tab-options')

describe('buildSidePanelNewTabOptions', () => {
  it('offers exactly the four creatable kinds, in canvas order', () => {
    expect(buildSidePanelNewTabOptions(true)).toEqual([
      { kind: 'new-terminal', label: 'New Terminal' },
      { kind: 'new-browser', label: 'New Browser Tab' },
      { kind: 'new-markdown', label: 'New Markdown' },
      { kind: 'new-simulator', label: 'New Mobile Emulator' }
    ])
  })

  it('drops the mobile emulator when the setting turns it off', () => {
    expect(buildSidePanelNewTabOptions(false).map((option) => option.kind)).toEqual([
      'new-terminal',
      'new-browser',
      'new-markdown'
    ])
  })
})
