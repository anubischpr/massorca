import { describe, expect, it } from 'vitest'
import { grokSettleRequest } from './grok-requests'

describe('grokSettleRequest', () => {
  it('tells Grok its plan was shown under the MassOrca name and to wait for feedback', () => {
    const settlement = grokSettleRequest('x.ai/exit_plan_mode', {
      sessionId: 'session-1',
      toolCallId: 'call-1',
      planContent: '1. Read the parser'
    })

    expect(settlement?.reply).toEqual({
      outcome: 'abandoned',
      feedback:
        'MassOrca showed your plan to the user. Stop here and wait for their feedback or a request to implement it in a later turn.'
    })
    expect(settlement?.plan).toBe('1. Read the parser')
  })
})
