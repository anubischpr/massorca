import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import {
  nativeChatChecklistFenceBlock,
  nativeChatChecklistRepliesFromItems,
  withoutNativeChatChecklistBlocks
} from './native-chat-checklist-replies'

const CHECKLIST = '```orca-checklist\ntitle: QA preview\n- [x] Login works\n- [ ] Logout works\n```'

function message(
  itemId: string,
  role: 'user' | 'assistant',
  text: string,
  observedAt: number,
  agentId?: string
): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence: observedAt,
    observedAt,
    ...(agentId ? { agentId } : {}),
    body: { kind: 'message', role, blocks: [{ type: 'text', text }] }
  }
}

describe('nativeChatChecklistRepliesFromItems', () => {
  it('keeps only the main agent replies that carry a checklist, at their observed time', () => {
    const replies = nativeChatChecklistRepliesFromItems([
      message('user-1', 'user', CHECKLIST, 100),
      message('plain', 'assistant', 'No list here', 200),
      message('lead', 'assistant', `Here it is.\n${CHECKLIST}`, 300),
      message('sub', 'assistant', CHECKLIST, 400, 'subagent-1')
    ])

    expect(replies).toHaveLength(1)
    expect(replies[0]?.at).toBe(300)
    expect(replies[0]?.markdown).toContain('orca-checklist')
  })
})

describe('withoutNativeChatChecklistBlocks', () => {
  it('removes checklist fences and keeps other code blocks intact', () => {
    const text = `Plan:\n${CHECKLIST}\n\`\`\`ts\nconst x = 1\n\`\`\`\nDone.`

    const stripped = withoutNativeChatChecklistBlocks(text)

    expect(stripped).not.toContain('orca-checklist')
    expect(stripped).not.toContain('Login works')
    expect(stripped).toContain('```ts\nconst x = 1\n```')
    expect(stripped.startsWith('Plan:')).toBe(true)
    expect(stripped.endsWith('Done.')).toBe(true)
  })

  it('removes an unclosed checklist fence to the end of the reply', () => {
    expect(withoutNativeChatChecklistBlocks('Intro\n```orca-checklist\n- [ ] Open')).toBe('Intro')
  })
})

describe('nativeChatChecklistFenceBlock', () => {
  it('reads the title and the checked items of a transcript fence', () => {
    const block = nativeChatChecklistFenceBlock(
      'title: QA preview\n- [x] Login works\n- [ ] Logout'
    )

    expect(block?.title).toBe('QA preview')
    expect(block?.items).toEqual([
      { text: 'Login works', checked: true },
      { text: 'Logout', checked: false }
    ])
  })
})
