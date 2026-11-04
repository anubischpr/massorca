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
  SessionPanePicker: () => <div data-testid="picker" />
}))
vi.mock('../editor/EditorPanel', () => ({ default: () => null }))

import TabGroupPanel from './TabGroupPanel'

const VEIL_SELECTOR = '[data-tab-group-unfocused-veil]'

function panel(
  groupId: string,
  isFocused: boolean,
  hasSplitGroups: boolean
): ReturnType<typeof render> {
  return render(
    <TabGroupPanel
      groupId={groupId}
      worktreeId="wt"
      isVisible
      isFocused={isFocused}
      hasSplitGroups={hasSplitGroups}
      touchesLeftEdge
      touchesRightEdge
    />
  )
}

afterEach(cleanup)

describe('TabGroupPanel dims the session text of an unfocused split pane', () => {
  it('veils the body of an unfocused pane of a split, so the sessions the body hosts dim with it', () => {
    const view = panel('pane1', false, true)
    const veil = view.container.querySelector(VEIL_SELECTOR)
    expect(veil).not.toBeNull()
    expect(veil?.parentElement?.getAttribute('data-tab-group-body-id')).toBe('pane1')
    expect(veil?.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves the focused pane of a split undimmed', () => {
    expect(panel('pane1', true, true).container.querySelector(VEIL_SELECTOR)).toBeNull()
  })

  it('never veils a lone group, which has nothing to contrast with', () => {
    expect(panel('main', false, false).container.querySelector(VEIL_SELECTOR)).toBeNull()
  })

  it('keeps opacity off the group root, since an opacity stacking context would paint the veil under the session hosts', () => {
    const view = panel('pane1', false, true)
    const root = view.container.firstElementChild as HTMLElement
    expect(root.className).not.toMatch(/\bopacity-/)
  })
})
