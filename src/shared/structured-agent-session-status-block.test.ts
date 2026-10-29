import { describe, expect, it } from 'vitest'
import type { AgentJournalStatusItem } from './agent-session-journal-types'
import { structuredAgentSessionStatusBlock } from './structured-agent-session-status-block'

describe('structuredAgentSessionStatusBlock', () => {
  it('carries a delegated session notice payload that the reader accepts', () => {
    const delegation = {
      requestId: 'req-1',
      title: 'Explore',
      status: 'failed' as const,
      reason: 'No agent is connected'
    }
    const block = structuredAgentSessionStatusBlock({
      kind: 'status',
      text: 'Could not start',
      tone: 'error',
      delegation
    })
    expect(block).toEqual({ type: 'text', text: 'Could not start', tone: 'error', delegation })
  })

  it('adds no delegation field to a status row without one', () => {
    const block = structuredAgentSessionStatusBlock({ kind: 'status', text: 'Plain' })
    expect(block).toEqual({ type: 'text', text: 'Plain' })
    expect(Object.hasOwn(block, 'delegation')).toBe(false)
  })

  it('reads the status item it is given without changing the plain fields', () => {
    const body: AgentJournalStatusItem = { kind: 'status', text: 'Done', tone: 'notice' }
    expect(structuredAgentSessionStatusBlock(body)).toEqual({
      type: 'text',
      text: 'Done',
      tone: 'notice'
    })
  })
})
