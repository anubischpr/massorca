import { describe, expect, it } from 'vitest'
import { useFloatingChecklistPinStore } from './floating-checklist-pin'
import { followedOrPinnedChecklistSession } from './use-floating-checklist-session'

describe('a hand-picked session against following focus', () => {
  const followed = 'from-focus'

  it('follows focus until a session is picked, and stays on the pick while focus moves', () => {
    useFloatingChecklistPinStore.setState({ pinnedSessionByTabId: {} })
    expect(followedOrPinnedChecklistSession(null, followed)).toEqual({
      sessionId: 'from-focus',
      pinned: false
    })
    useFloatingChecklistPinStore.getState().pin('tab', 'picked')
    const pinned = useFloatingChecklistPinStore.getState().pinnedSessionByTabId.tab
    expect(followedOrPinnedChecklistSession(pinned ?? null, 'focus-moved')).toEqual({
      sessionId: 'picked',
      pinned: true
    })
  })

  it('goes back to the focus when Follow focus is chosen, and only for that tab', () => {
    const { pin, followFocus } = useFloatingChecklistPinStore.getState()
    pin('tab', 'picked')
    pin('other', 'kept')
    followFocus('tab')
    const pins = useFloatingChecklistPinStore.getState().pinnedSessionByTabId
    expect(pins.tab).toBeUndefined()
    expect(pins.other).toBe('kept')
    expect(followedOrPinnedChecklistSession(pins.tab ?? null, 'from-focus').pinned).toBe(false)
  })
})
