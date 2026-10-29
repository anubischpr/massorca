import { describe, expect, it } from 'vitest'
import { neighbourTabAfterClose, resolveMobileSessionActiveKind } from './mobile-session-active-tab'

const TABS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('neighbourTabAfterClose', () => {
  it('selects the tab that took the closed tab place', () => {
    // 'b' (index 1) closed: the remaining list is [a, c], and index 1 is now 'c'.
    expect(neighbourTabAfterClose([{ id: 'a' }, { id: 'c' }], 1)?.id).toBe('c')
  })

  it('selects the new last tab when the last tab closed', () => {
    expect(neighbourTabAfterClose([{ id: 'a' }, { id: 'b' }], 2)?.id).toBe('b')
  })

  it('selects the first tab when the first tab closed', () => {
    expect(neighbourTabAfterClose([{ id: 'b' }, { id: 'c' }], 0)?.id).toBe('b')
  })

  it('selects nothing only when no tab remains', () => {
    expect(neighbourTabAfterClose([], 0)).toBeNull()
    expect(neighbourTabAfterClose(TABS.slice(0, 1), 0)?.id).toBe('a')
  })
})

describe('resolveMobileSessionActiveKind', () => {
  it('reads the active tab kind when the tab is listed', () => {
    expect(resolveMobileSessionActiveKind('browser', 'terminal')).toBe('browser')
  })

  it('keeps the last known kind while the active tab is not listed yet', () => {
    expect(resolveMobileSessionActiveKind(undefined, 'terminal')).toBe('terminal')
    expect(resolveMobileSessionActiveKind(null, 'agent-session')).toBe('agent-session')
  })

  it('is unknown only when nothing was ever known', () => {
    expect(resolveMobileSessionActiveKind(undefined, null)).toBeNull()
  })
})
