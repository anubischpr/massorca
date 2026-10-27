import { describe, expect, it } from 'vitest'
import {
  mobileChatChromeSegmentPanel,
  resolveMobileChatChromeSegments
} from './mobile-chat-chrome-segments'

describe('resolveMobileChatChromeSegments', () => {
  it('shows Chat alone in a floating workspace, with its panels hidden', () => {
    expect(
      resolveMobileChatChromeSegments({
        activePanel: null,
        showFiles: false,
        showSourceControl: false
      })
    ).toEqual([{ id: 'chat', label: 'Chat', active: true }])
  })

  it('shows Files and Source control beside Chat in a git worktree', () => {
    const segments = resolveMobileChatChromeSegments({
      activePanel: 'files',
      showFiles: true,
      showSourceControl: true
    })
    expect(segments.map((segment) => [segment.id, segment.active])).toEqual([
      ['chat', false],
      ['files', true],
      ['sourceControl', false]
    ])
  })

  it('leaves the Files segment out in a folder workspace that has source control', () => {
    const segments = resolveMobileChatChromeSegments({
      activePanel: null,
      showFiles: false,
      showSourceControl: true
    })
    expect(segments.map((segment) => segment.id)).toEqual(['chat', 'sourceControl'])
  })

  it('leaves Chat inactive while a route-based panel such as checks is open', () => {
    const [chat] = resolveMobileChatChromeSegments({
      activePanel: 'pr',
      showFiles: true,
      showSourceControl: true
    })
    expect(chat.active).toBe(false)
  })
})

describe('mobileChatChromeSegmentPanel', () => {
  it('routes Files and Source control to the panels the header icons open, and Chat to none', () => {
    expect(mobileChatChromeSegmentPanel('files')).toBe('files')
    expect(mobileChatChromeSegmentPanel('sourceControl')).toBe('sourceControl')
    expect(mobileChatChromeSegmentPanel('chat')).toBeNull()
  })
})
