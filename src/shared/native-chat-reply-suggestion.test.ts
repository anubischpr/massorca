import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from './agent-session-journal-types'
import {
  buildReplySuggestionPrompt,
  lastReplySuggestionExchange,
  MAX_REPLY_SUGGESTION_LENGTH,
  normalizeReplySuggestionText,
  REPLY_SUGGESTION_CONTEXT_LIMIT,
  sameReplySuggestion
} from './native-chat-reply-suggestion'

let sequence = 0
function row(role: 'user' | 'assistant', text: string): AgentJournalRenderItem {
  sequence += 1
  return {
    itemId: `item-${sequence}`,
    sequence,
    revision: 1,
    observedAt: sequence,
    body: { kind: 'message', role, blocks: [{ type: 'text', text }] }
  }
}

describe('normalizeReplySuggestionText', () => {
  it('flattens to one line and strips wrapping quotes and labels', () => {
    expect(normalizeReplySuggestionText('Reply: "Run the   tests please"\n')).toBe(
      'Run the tests please'
    )
    expect(normalizeReplySuggestionText('\n"Run it"\nBecause the tests are missing.')).toBe(
      'Run it'
    )
    expect(normalizeReplySuggestionText('“Looks good”')).toBe('Looks good')
  })

  it('rejects empty, punctuation-only and reasoning output', () => {
    expect(normalizeReplySuggestionText('  ')).toBeNull()
    expect(normalizeReplySuggestionText('...')).toBeNull()
    expect(normalizeReplySuggestionText('<think>hm</think> ok')).toBeNull()
  })

  it('caps the length', () => {
    const text = normalizeReplySuggestionText('word '.repeat(200))
    expect(text?.length).toBeLessThanOrEqual(MAX_REPLY_SUGGESTION_LENGTH)
  })
})

describe('lastReplySuggestionExchange', () => {
  it('pairs the newest user message with the prose that followed it', () => {
    const exchange = lastReplySuggestionExchange([
      row('user', 'old question'),
      row('assistant', 'old answer that is long enough to count'),
      row('user', 'Fix the login bug'),
      row('assistant', 'I found the cause in the session middleware.'),
      row('assistant', 'The fix is applied and the tests pass.')
    ])
    expect(exchange).toEqual({
      userMessage: 'Fix the login bug',
      assistantMessage:
        'I found the cause in the session middleware.\n\nThe fix is applied and the tests pass.'
    })
  })

  it('skips a turn that said too little or has no user message', () => {
    expect(lastReplySuggestionExchange([row('user', 'hi'), row('assistant', 'ok')])).toBeNull()
    expect(
      lastReplySuggestionExchange([row('assistant', 'A long unprompted assistant line')])
    ).toBeNull()
    expect(lastReplySuggestionExchange([])).toBeNull()
  })
})

describe('buildReplySuggestionPrompt', () => {
  it('keeps the end of a long reply inside the context budget', () => {
    const prompt = buildReplySuggestionPrompt({
      userMessage: 'Do it',
      assistantMessage: `${'x'.repeat(10_000)} FINAL QUESTION?`
    })
    expect(prompt).toContain('FINAL QUESTION?')
    expect(prompt.length).toBeLessThan(REPLY_SUGGESTION_CONTEXT_LIMIT + 600)
  })
})

describe('sameReplySuggestion', () => {
  it('compares turn and text, treating absent and null alike', () => {
    const a = { turnId: 't', text: 'x', source: 'native' as const }
    expect(sameReplySuggestion(a, { ...a, source: 'emulated' })).toBe(true)
    expect(sameReplySuggestion(a, { ...a, text: 'y' })).toBe(false)
    expect(sameReplySuggestion(null, undefined)).toBe(true)
  })
})
