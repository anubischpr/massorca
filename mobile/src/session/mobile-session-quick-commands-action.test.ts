import { describe, expect, it, vi } from 'vitest'
import { resolveMobileSessionQuickCommandsAction } from './mobile-session-quick-commands-action'

describe('resolveMobileSessionQuickCommandsAction', () => {
  it('opens quick commands when the desktop supports them', () => {
    const open = vi.fn()
    const toast = vi.fn()
    resolveMobileSessionQuickCommandsAction(true, { open, toast })
    expect(open).toHaveBeenCalledTimes(1)
    expect(toast).not.toHaveBeenCalled()
  })

  it('names the desktop update when the desktop is too old', () => {
    const toast = vi.fn()
    resolveMobileSessionQuickCommandsAction(false, { open: vi.fn(), toast })
    expect(toast).toHaveBeenCalledWith('Desktop update required for quick commands', 1600)
  })

  it('asks for a moment while the desktop capability is still unknown', () => {
    const open = vi.fn()
    const toast = vi.fn()
    resolveMobileSessionQuickCommandsAction(null, { open, toast })
    expect(open).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(
      'Checking desktop capabilities — try again in a moment',
      1600
    )
  })
})
