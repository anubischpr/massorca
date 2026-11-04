import { describe, expect, it } from 'vitest'
import type { TabGroup } from '../../../../shared/tab-types'
import { sidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import {
  isPaneGroupInSplit,
  nativeChatPaneHeaderPlacement
} from './native-chat-pane-header-placement'

function group(id: string, worktreeId = 'wt'): TabGroup {
  return { id, worktreeId, activeTabId: null, tabOrder: [] }
}

describe('nativeChatPaneHeaderPlacement', () => {
  it('shows no header for a chat whose pane is not on screen', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: false,
        inline: false,
        inSplit: true,
        ownsSessionBar: true
      })
    ).toBe('hidden')
  })

  it('keeps the inline header for a floating or unplaced chat', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: true,
        inSplit: false,
        ownsSessionBar: false
      })
    ).toBe('inline')
  })

  it('gives every chat in a split its own pane row, focused or not', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: true,
        ownsSessionBar: true
      })
    ).toBe('pane-row')
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: true,
        ownsSessionBar: false
      })
    ).toBe('pane-row')
  })

  it('moves the focused chat of a single pane into the session bar', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: false,
        ownsSessionBar: true
      })
    ).toBe('session-bar')
  })

  it('shows no header for a visible single-pane chat that is not the focused session', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: false,
        ownsSessionBar: false
      })
    ).toBe('hidden')
  })

  it('renders a split chat into the top row when its pane touches the top edge', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: true,
        ownsSessionBar: false,
        topBarMounted: true
      })
    ).toBe('top-bar')
  })

  it('keeps a split chat in its own pane row when its pane is not at the top edge', () => {
    expect(
      nativeChatPaneHeaderPlacement({
        isVisible: true,
        inline: false,
        inSplit: true,
        ownsSessionBar: false,
        topBarMounted: false
      })
    ).toBe('pane-row')
  })
})

describe('isPaneGroupInSplit', () => {
  it('is false for the only pane of its layout', () => {
    expect(isPaneGroupInSplit({ wt: [group('main')] }, 'main')).toBe(false)
  })

  it('is true for a pane with a neighbour in the same layout', () => {
    expect(isPaneGroupInSplit({ wt: [group('main'), group('pane2')] }, 'pane2')).toBe(true)
  })

  it('reads the layout that holds a referenced pane, not the chat workspace', () => {
    expect(
      isPaneGroupInSplit(
        { a: [group('a-main', 'a'), group('ref', 'a')], b: [group('b-main', 'b')] },
        'ref'
      )
    ).toBe(true)
  })

  it('does not count the side panel group as a neighbour', () => {
    expect(isPaneGroupInSplit({ wt: [group('main'), group(sidePanelGroupId('wt'))] }, 'main')).toBe(
      false
    )
  })

  it('is false for the side panel group itself, or for a group no layout holds', () => {
    expect(
      isPaneGroupInSplit(
        { wt: [group('main'), group(sidePanelGroupId('wt'))] },
        sidePanelGroupId('wt')
      )
    ).toBe(false)
    expect(isPaneGroupInSplit({ wt: [group('main')] }, 'missing')).toBe(false)
    expect(isPaneGroupInSplit({ wt: [group('main')] }, undefined)).toBe(false)
  })
})
