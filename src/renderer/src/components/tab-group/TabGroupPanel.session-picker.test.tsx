// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { activeWorktreeId: 'wt', groupsByWorktree: {} }
  const useAppStore = (selector: (current: typeof state) => unknown): unknown => selector(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/store', () => ({ useAppStore: mocks.useAppStore }))
vi.mock('../../store', () => ({ useAppStore: mocks.useAppStore }))
vi.mock('./useTabGroupWorkspaceModel', () => ({
  useTabGroupWorkspaceModel: () => ({
    activeTab: null,
    commands: { focusGroup: () => undefined }
  })
}))
vi.mock('./SessionPanePicker', () => ({
  SessionPanePicker: ({ groupId }: { groupId: string }) => (
    <div data-testid="picker" data-group={groupId} />
  )
}))
vi.mock('../editor/EditorPanel', () => ({ default: () => null }))

import TabGroupPanel from './TabGroupPanel'

function panel(groupId: string, hasSplitGroups: boolean): ReturnType<typeof render> {
  return render(
    <TabGroupPanel
      groupId={groupId}
      worktreeId="wt"
      isVisible
      isFocused
      hasSplitGroups={hasSplitGroups}
      touchesLeftEdge
      touchesRightEdge
    />
  )
}

afterEach(cleanup)

describe('TabGroupPanel with no session in it', () => {
  it('offers the session picker in an empty pane of a split', () => {
    const view = panel('pane2', true)
    expect(view.getByTestId('picker').getAttribute('data-group')).toBe('pane2')
  })

  it('shows nothing extra when the pane is the only one, since the empty main area has its own Create', () => {
    expect(panel('main', false).queryByTestId('picker')).toBeNull()
  })

  it('never puts the session picker in the side panel', () => {
    expect(panel('side-panel:wt', true).queryByTestId('picker')).toBeNull()
  })
})
