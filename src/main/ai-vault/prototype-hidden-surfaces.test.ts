import { describe, expect, it } from 'vitest'
import { normalizePromptField } from '../../shared/agent-status-field-normalization'
import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import { buildPrototypeRequestMessage } from '../../shared/prototype-request'
import { firstStructuredAgentSessionPrompt } from '../../shared/structured-agent-session-first-prompt'
import { normalizePreviewText } from './session-scanner-text-normalization'
import { normalizeFullFirstUserPromptText } from './session-scanner-first-user-prompt'
import { transcriptMessagesFromContent } from './session-transcript-message-content'

function sent(text: string, agent: 'claude' | 'codex' | 'gentle-shell' = 'codex'): string {
  return buildPrototypeRequestMessage({
    text,
    agent,
    count: 2,
    requestId: '20261028-201500-k3f9q2',
    folderPath: '/work/prototypes/20261028-201500-k3f9q2'
  }).sentText
}

const KEYWORD = 'Make a mockup of the pricing page'
const COMMAND = '/prototype make a login page'

function expectNoHiddenText(value: string | null | undefined): void {
  expect(value ?? '').not.toContain('orca-prototype')
  expect(value ?? '').not.toContain('distinct design directions')
  expect(value ?? '').not.toContain('self-contained HTML')
}

describe('the sidebar last-prompt preview of an agent status', () => {
  it.each([
    [KEYWORD, KEYWORD],
    [COMMAND, COMMAND],
    ['/prototipo hazme un login', '/prototipo hazme un login']
  ])('shows %j as typed, folded to one line', (typed, shown) => {
    const prompt = normalizePromptField(sent(typed))
    expect(prompt).toBe(shown)
    expectNoHiddenText(prompt)
  })

  it('shows the typed command of a Gentle Shell request, not its translation', () => {
    expect(normalizePromptField(sent(COMMAND, 'gentle-shell'))).toBe(COMMAND)
  })

  it('leaves an ordinary prompt alone', () => {
    expect(normalizePromptField('  fix the\nbuild  ')).toBe('fix the build')
  })
})

describe('the chat name source', () => {
  it('reads the first prompt as typed', () => {
    const items: AgentJournalRenderItem[] = [
      {
        itemId: 'message:one',
        revision: 1,
        sequence: 1,
        observedAt: 1,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: sent(COMMAND) }] }
      }
    ]
    expect(firstStructuredAgentSessionPrompt(items)).toBe(COMMAND)
  })
})

describe('Agent history', () => {
  it('previews a user prompt as typed and leaves a reply alone', () => {
    expect(normalizePreviewText(sent(KEYWORD), 'user')).toBe(KEYWORD)
    expect(normalizePreviewText(sent(COMMAND), 'user')).toBe(COMMAND)
    expect(
      normalizePreviewText('see <!-- orca-prototype-request:abc --> here', 'assistant')
    ).toContain('orca-prototype')
  })

  it('copies the first prompt as typed', () => {
    expect(normalizeFullFirstUserPromptText(sent(COMMAND))).toBe(COMMAND)
  })

  it('reads user transcript messages as typed, from a string or from content blocks', () => {
    const fromString = transcriptMessagesFromContent('user', sent(COMMAND), null)
    expect(fromString.map((message) => message.text)).toEqual([COMMAND])
    const fromBlocks = transcriptMessagesFromContent(
      'user',
      [{ type: 'text', text: sent(KEYWORD) }],
      null
    )
    expect(fromBlocks.map((message) => message.text)).toEqual([KEYWORD])
    expectNoHiddenText(fromBlocks[0]?.text)
  })

  it('keeps an assistant message verbatim', () => {
    const marker = '<!-- orca-prototype-request:abc -->\nProduce'
    expect(
      transcriptMessagesFromContent('assistant', [{ type: 'text', text: marker }], null)[0]?.text
    ).toBe(marker)
  })
})
