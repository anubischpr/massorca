import { describe, expect, it, vi } from 'vitest'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import { createClaudeJournalTranslator } from './claude-structured-journal-translation'

function harness() {
  const rows: unknown[] = []
  const suggestions: unknown[] = []
  const sink: StructuredAgentSessionEventSink = {
    appendItem: (identity, body) => rows.push({ identity, body }),
    appendTombstone: vi.fn(),
    publish: vi.fn(),
    setPromptSuggestion: (suggestion) => suggestions.push(suggestion)
  }
  return { translator: createClaudeJournalTranslator({ sink, coalesceMs: 0 }), rows, suggestions }
}

function frame(message: Record<string, unknown>) {
  return { type: 'message' as const, sessionId: 'orca-session', message }
}

describe('Claude prompt_suggestion frame', () => {
  it('becomes an ephemeral suggestion for the turn that just ended, with no journal row', () => {
    const { translator, rows, suggestions } = harness()
    translator.handle({
      ...frame({ type: 'user', uuid: 'user-1', message: { role: 'user', content: 'hi' } }),
      startsTurn: true
    })
    translator.handle(
      frame({
        type: 'assistant',
        uuid: 'a-1',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] }
      })
    )
    translator.handle(frame({ type: 'result', usage: { input_tokens: 1 } }))
    const rowsBefore = rows.length

    translator.handle(
      frame({ type: 'prompt_suggestion', suggestion: 'Run the tests', uuid: 'suggestion-uuid' })
    )

    expect(rows).toHaveLength(rowsBefore)
    expect(suggestions).toEqual([{ turnId: expect.any(String), text: 'Run the tests' }])
  })

  it('falls back to the frame uuid when no turn was ever open, and clears on empty text', () => {
    const { translator, suggestions } = harness()
    translator.handle(frame({ type: 'prompt_suggestion', suggestion: 'Next', uuid: 'u-1' }))
    translator.handle(frame({ type: 'prompt_suggestion', suggestion: '', uuid: 'u-2' }))
    expect(suggestions).toEqual([{ turnId: 'u-1', text: 'Next' }, null])
  })

  it('is dropped quietly by a sink with no suggestion channel', () => {
    const rows: unknown[] = []
    const translator = createClaudeJournalTranslator({
      sink: {
        appendItem: (...args) => rows.push(args),
        appendTombstone: vi.fn(),
        publish: vi.fn()
      },
      coalesceMs: 0
    })
    translator.handle(frame({ type: 'prompt_suggestion', suggestion: 'Next', uuid: 'u-1' }))
    expect(rows).toEqual([])
  })
})
