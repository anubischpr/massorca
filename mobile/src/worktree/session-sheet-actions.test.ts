import { describe, expect, it, vi } from 'vitest'
import { buildSessionSheetActions, canManageSessionTerminal } from './session-sheet-actions'

vi.mock('lucide-react-native', () => ({
  Copy: 'Copy',
  FolderGit2: 'FolderGit2',
  Pencil: 'Pencil',
  X: 'X'
}))

const LEAF = '33333333-3333-4333-8333-333333333333'
const OTHER_LEAF = '44444444-4444-4444-8444-444444444444'

const liveRow = {
  paneKey: `tab-a:${LEAF}`,
  parentPaneKey: null,
  terminalHandle: 'term_live'
}

describe('buildSessionSheetActions', () => {
  it('offers only Copy Path when the row may not manage its terminal', () => {
    const actions = buildSessionSheetActions({ onCopyPath: vi.fn() })
    expect(actions.map((action) => action.label)).toEqual(['Copy Path'])
  })

  it('offers Rename, Copy Path and Close in that order, Rename and Close after the sheet closes', () => {
    const actions = buildSessionSheetActions({
      onCopyPath: vi.fn(),
      onRename: vi.fn(),
      onClose: vi.fn()
    })
    expect(actions.map((action) => action.label)).toEqual(['Rename', 'Copy Path', 'Close'])
    expect(actions[0]?.closeBeforePress).toBe(true)
    expect(actions[2]?.destructive).toBe(true)
  })

  it('opens the worktree sheet after this sheet closes when the row asks for it', () => {
    const onOpenWorktree = vi.fn()
    const actions = buildSessionSheetActions({ onCopyPath: vi.fn(), onOpenWorktree })
    expect(actions.map((action) => action.label)).toEqual(['Copy Path', 'Worktree'])
    expect(actions[1]?.closeBeforePress).toBe(true)
    actions[1]?.onPress()
    expect(onOpenWorktree).toHaveBeenCalledOnce()
  })

  it('runs the callback of the action it names', () => {
    const onCopyPath = vi.fn()
    const onRename = vi.fn()
    const onClose = vi.fn()
    const actions = buildSessionSheetActions({ onCopyPath, onRename, onClose })
    actions.find((action) => action.label === 'Copy Path')?.onPress()
    actions.find((action) => action.label === 'Rename')?.onPress()
    actions.find((action) => action.label === 'Close')?.onPress()
    expect(onCopyPath).toHaveBeenCalledOnce()
    expect(onRename).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('canManageSessionTerminal', () => {
  it('lets a row with a live handle rename and close its own tab', () => {
    expect(canManageSessionTerminal(liveRow, { runsElsewhere: false })).toBe(true)
  })

  it('refuses a row with no live handle, such as a subagent or a stale row', () => {
    expect(
      canManageSessionTerminal({ ...liveRow, terminalHandle: undefined }, { runsElsewhere: false })
    ).toBe(false)
  })

  it('refuses a session that runs in another worktree than the one it is listed in', () => {
    expect(canManageSessionTerminal(liveRow, { runsElsewhere: true })).toBe(false)
  })

  it('refuses a child that shares its parent tab, and allows a child in another tab', () => {
    const sharedTab = { ...liveRow, parentPaneKey: `tab-a:${OTHER_LEAF}` }
    expect(canManageSessionTerminal(sharedTab, { runsElsewhere: false })).toBe(false)
    const ownTab = { ...liveRow, parentPaneKey: `tab-b:${OTHER_LEAF}` }
    expect(canManageSessionTerminal(ownTab, { runsElsewhere: false })).toBe(true)
  })
})
