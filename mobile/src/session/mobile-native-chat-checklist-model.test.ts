import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  mobileNativeChatChecklistItemMeta,
  mobileNativeChatChecklistMenuHint,
  mobileNativeChatChecklistScreenshotName,
  mobileNativeChatChecklistSourceLine,
  mobileNativeChatChecklistUnseenText,
  nativeChatChecklistRepliesOf,
  nativeChatChecklistWrittenAt,
  splitNativeChatChecklistMarkdown,
  withoutNativeChatChecklistFences
} from './mobile-native-chat-checklist-model'

const BLOCK = ['```orca-checklist', 'title: QA preview', '- [ ] Open the summary', '- [x] Plan shows', '```'].join(
  '\n'
)

function assistant(id: string, text: string, timestamp: number | null): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [{ type: 'text', text }],
    timestamp,
    source: 'transcript'
  }
}

describe('splitNativeChatChecklistMarkdown', () => {
  it('draws the finished fence as one checklist segment, with the prose around it as markdown', () => {
    expect(splitNativeChatChecklistMarkdown(`Here it is.\n\n${BLOCK}\n\nTell me what fails.`)).toEqual([
      { kind: 'markdown', text: 'Here it is.' },
      { kind: 'checklist', text: BLOCK },
      { kind: 'markdown', text: 'Tell me what fails.' }
    ])
  })

  it('keeps an unclosed fence as markdown, since the shared parser counts a block only once it closes', () => {
    const streaming = '```orca-checklist\ntitle: QA\n- [ ] Open the summary'
    expect(splitNativeChatChecklistMarkdown(streaming)).toEqual([
      { kind: 'markdown', text: streaming }
    ])
  })

  it('leaves other code fences alone, even one that quotes the checklist fence inside it', () => {
    const quoted = '````md\n```orca-checklist\n- [ ] inside\n```\n````'
    expect(splitNativeChatChecklistMarkdown(quoted)).toEqual([{ kind: 'markdown', text: quoted }])
  })

  it('closes a tilde fence with a tilde fence of at least its length', () => {
    const tilde = '~~~orca-checklist\n- [ ] Open the summary\n~~~'
    expect(splitNativeChatChecklistMarkdown(tilde)).toEqual([{ kind: 'checklist', text: tilde }])
  })

  it('reads CRLF line endings as the shared parser does', () => {
    const crlf = BLOCK.replace(/\n/g, '\r\n')
    expect(splitNativeChatChecklistMarkdown(crlf)).toEqual([{ kind: 'checklist', text: crlf }])
  })
})

describe('withoutNativeChatChecklistFences', () => {
  it('drops the checklist fence from a plain-text preview and keeps the prose', () => {
    expect(withoutNativeChatChecklistFences(`Before.\n${BLOCK}\nAfter.`)).toBe('Before.\nAfter.')
  })
})

describe('nativeChatChecklistRepliesOf', () => {
  it('takes only the main agent replies that carry a checklist fence, with their clock', () => {
    const replies = nativeChatChecklistRepliesOf([
      assistant('a1', 'no list here', 100),
      assistant('a2', BLOCK, 200),
      { ...assistant('a3', BLOCK, 300), agentId: 'sub-1' },
      { ...assistant('u1', BLOCK, 400), role: 'user' },
      assistant('a4', BLOCK, null)
    ])
    expect(replies).toEqual([
      { at: 200, markdown: BLOCK },
      { at: 0, markdown: BLOCK }
    ])
  })
})

describe('nativeChatChecklistWrittenAt', () => {
  it('is the newest reply that holds a finished block, and null while there is none', () => {
    const replies = nativeChatChecklistRepliesOf([
      assistant('a1', BLOCK, 100),
      assistant('a2', '```orca-checklist\n- [ ] still typing', 200)
    ])
    expect(nativeChatChecklistWrittenAt(replies)).toBe(100)
    expect(nativeChatChecklistWrittenAt([])).toBeNull()
  })
})

describe('mobileNativeChatChecklistSourceLine', () => {
  it('names the title, the agent and the clock the agent last wrote the list', () => {
    const at = new Date(2026, 10, 2, 13, 52).getTime()
    expect(
      mobileNativeChatChecklistSourceLine({ title: 'QA preview', agentLabel: 'Claude', at })
    ).toBe('QA preview · from Claude, 13:52')
    expect(mobileNativeChatChecklistSourceLine({ title: null, agentLabel: 'Claude', at: null })).toBe(
      'from Claude'
    )
  })
})

describe('mobileNativeChatChecklistItemMeta', () => {
  const at = new Date(2026, 10, 2, 14, 2).getTime()

  it('names who checked the item and when, as the board shows it', () => {
    expect(
      mobileNativeChatChecklistItemMeta(
        { by: 'person', at, note: null, screenshots: [] },
        'Claude'
      )
    ).toBe('You · 14:02')
    expect(
      mobileNativeChatChecklistItemMeta({ by: 'agent', at, note: null, screenshots: [] }, 'Claude')
    ).toBe('Claude · 14:02')
  })

  it('adds the note and the screenshot count after who checked it', () => {
    const shot = { path: '/tmp/a.png', name: 'a.png' }
    expect(
      mobileNativeChatChecklistItemMeta(
        { by: null, at: null, note: 'Sheet opens', screenshots: [shot] },
        'Claude'
      )
    ).toBe('Note · 1 screenshot')
    expect(
      mobileNativeChatChecklistItemMeta({ by: null, at: null, note: null, screenshots: [] }, 'Claude')
    ).toBeNull()
  })

  it('says an item the person added is added by them, until a check or a note applies', () => {
    const added = new Date(2026, 10, 2, 14, 5).getTime()
    const shot = { path: '/tmp/a.png', name: 'a.png' }
    expect(
      mobileNativeChatChecklistItemMeta(
        { by: null, at: null, note: null, screenshots: [], addedAt: added },
        'Claude'
      )
    ).toBe('Added by you · 14:05')
    expect(
      mobileNativeChatChecklistItemMeta(
        { by: null, at: null, note: 'Sheet opens', screenshots: [], addedAt: added },
        'Claude'
      )
    ).toBe('Note')
    expect(
      mobileNativeChatChecklistItemMeta(
        { by: 'person', at, note: null, screenshots: [shot], addedAt: added },
        'Claude'
      )
    ).toBe('You · 14:02 · 1 screenshot')
  })
})

describe('mobileNativeChatChecklistMenuHint', () => {
  it('counts the checked items, and says No items while the list is empty or missing', () => {
    expect(mobileNativeChatChecklistMenuHint({ checked: 1, items: ['Open', 'Plan'] })).toBe(
      '1 of 2'
    )
    expect(mobileNativeChatChecklistMenuHint({ checked: 0, items: [] })).toBe('No items')
    expect(mobileNativeChatChecklistMenuHint(null)).toBe('No items')
  })
})

describe('mobileNativeChatChecklistUnseenText', () => {
  it('uses the board copy for one change and for several', () => {
    expect(mobileNativeChatChecklistUnseenText(1)).toBe(
      '1 change the agent has not seen. It goes with your next message.'
    )
    expect(mobileNativeChatChecklistUnseenText(3)).toBe(
      '3 changes the agent has not seen. They go with your next message.'
    )
  })
})

describe('mobileNativeChatChecklistScreenshotName', () => {
  it('names a screenshot by the last segment of its host path', () => {
    expect(mobileNativeChatChecklistScreenshotName('/var/tmp/clipboard-1.png')).toBe(
      'clipboard-1.png'
    )
    expect(mobileNativeChatChecklistScreenshotName('C:\\temp\\shot.png')).toBe('shot.png')
  })
})
