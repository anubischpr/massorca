import { describe, expect, it } from 'vitest'
import {
  mobileChatChromeSegmentPanel,
  resolveMobileChatChromeSegments
} from './mobile-chat-chrome-segments'

describe('resolveMobileChatChromeSegments', () => {
  it('shows Chat and Terminal in a floating workspace, with Files hidden', () => {
    expect(
      resolveMobileChatChromeSegments({
        activePanel: null,
        showFiles: false
      })
    ).toEqual([
      { id: 'chat', label: 'Chat', active: true },
      { id: 'terminal', label: 'Terminal', active: false }
    ])
  })

  it('shows Chat, Files and Terminal in a git worktree, marking the open panel', () => {
    const segments = resolveMobileChatChromeSegments({
      activePanel: 'files',
      showFiles: true
    })
    expect(segments.map((segment) => [segment.id, segment.active])).toEqual([
      ['chat', false],
      ['files', true],
      ['terminal', false]
    ])
  })

  it('marks Terminal active while the terminal panel is open', () => {
    const segments = resolveMobileChatChromeSegments({
      activePanel: 'terminal',
      showFiles: true
    })
    expect(segments.map((segment) => [segment.id, segment.active])).toEqual([
      ['chat', false],
      ['files', false],
      ['terminal', true]
    ])
  })

  it('never offers Source control in the segment control, which lives in the ⋯ menu', () => {
    for (const showFiles of [true, false]) {
      const ids = resolveMobileChatChromeSegments({ activePanel: null, showFiles }).map(
        (segment) => segment.id
      )
      expect(ids).not.toContain('sourceControl')
    }
  })

  it('leaves Chat inactive while a route-based panel such as checks is open', () => {
    const [chat] = resolveMobileChatChromeSegments({
      activePanel: 'pr',
      showFiles: true
    })
    expect(chat.active).toBe(false)
  })
})

describe('mobileChatChromeSegmentPanel', () => {
  it('routes Files and Terminal to their panels, and Chat to none', () => {
    expect(mobileChatChromeSegmentPanel('files')).toBe('files')
    expect(mobileChatChromeSegmentPanel('terminal')).toBe('terminal')
    expect(mobileChatChromeSegmentPanel('chat')).toBeNull()
  })
})
