import { describe, expect, it, vi } from 'vitest'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { WorktreeAgentRows } from '../session/mobile-worktree-agent-rows'
import { originChipOf, prototypeOriginChatOf } from './mobile-prototype-origin'

const PARENT_PANE = `${structuredAgentSessionTabId('parent-1')}:leaf-1`

/** A host listing with the parent chat as one pane, named or not. */
function listingWithParent(title?: string): WorktreeAgentRows[] {
  return [
    {
      worktreeId: 'wt-1',
      agents: [
        { paneKey: PARENT_PANE, parentPaneKey: null, ...(title === undefined ? {} : { title }) }
      ]
    }
  ]
}

describe('the parent chat of a set', () => {
  it('is the listed pane of the parent, with the name the host lists it by', () => {
    expect(prototypeOriginChatOf('parent-1', listingWithParent('nexuscare-planning'))).toEqual({
      worktreeId: 'wt-1',
      paneKey: PARENT_PANE,
      title: 'nexuscare-planning'
    })
  })

  it('still resolves a parent the host lists without a name, so it can be opened', () => {
    expect(prototypeOriginChatOf('parent-1', listingWithParent())).toEqual({
      worktreeId: 'wt-1',
      paneKey: PARENT_PANE,
      title: null
    })
  })

  it('is none when no worktree lists the parent', () => {
    expect(prototypeOriginChatOf('parent-1', [])).toBeNull()
    expect(prototypeOriginChatOf('other-chat', listingWithParent('x'))).toBeNull()
  })
})

describe('the origin chip of a set', () => {
  it('is none for a set made in a chat', () => {
    expect(originChipOf(undefined, listingWithParent('x'), vi.fn())).toBeNull()
  })

  it('names an unlisted parent "from parent chat", and offers no tap', () => {
    expect(originChipOf({ sessionId: 'parent-1' }, [], vi.fn())).toEqual({
      title: null,
      onPress: null
    })
  })

  it('opens the listed parent when tapped, even without a name', () => {
    const open = vi.fn()
    const chip = originChipOf({ sessionId: 'parent-1' }, listingWithParent(), open)
    expect(chip?.title).toBeNull()
    chip?.onPress?.()
    expect(open).toHaveBeenCalledWith({ worktreeId: 'wt-1', paneKey: PARENT_PANE, title: null })
  })
})
