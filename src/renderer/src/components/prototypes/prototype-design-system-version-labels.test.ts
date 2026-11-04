import { describe, expect, it, vi } from 'vitest'
import type { DesignSystemVersionListed } from '../../../../shared/rpc-contract/prototype-params'
import { designSystemVersionMeta } from './prototype-design-system-version-labels'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

// Local time: Wednesday 4 Nov 2026, 15:00.
const NOW = new Date(2026, 10, 4, 15, 0)

function version(overrides: Partial<DesignSystemVersionListed>): DesignSystemVersionListed {
  return { version: 3, saved: true, current: false, ...overrides }
}

describe('designSystemVersionMeta', () => {
  it('names a version made today by its time', () => {
    const at = new Date(2026, 10, 4, 14, 5).toISOString()
    expect(designSystemVersionMeta(version({ at, current: true }), NOW)).toMatch(/^Today, .*05/u)
  })

  it('says Yesterday, and marks an unsaved version as not saved', () => {
    const at = new Date(2026, 10, 3, 9, 0).toISOString()
    expect(designSystemVersionMeta(version({ at, saved: false }), NOW)).toBe(
      'Yesterday · not saved'
    )
  })

  it('shows an older date, and no time, for a version made before yesterday', () => {
    const at = new Date(2026, 9, 30, 9, 0).toISOString()
    const day = new Date(2026, 9, 30).toLocaleDateString([], { month: 'short', day: 'numeric' })
    expect(designSystemVersionMeta(version({ at, saved: false }), NOW)).toBe(`${day} · not saved`)
  })

  it('names only the state when the host recorded no time', () => {
    expect(designSystemVersionMeta(version({ saved: false }), NOW)).toBe('not saved')
  })

  it('shows nothing for a saved version with no time', () => {
    expect(designSystemVersionMeta(version({}), NOW)).toBeUndefined()
  })

  it('treats an unreadable time as no time', () => {
    expect(designSystemVersionMeta(version({ at: 'not a date', saved: false }), NOW)).toBe(
      'not saved'
    )
  })
})
