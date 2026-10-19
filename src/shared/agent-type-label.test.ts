import { describe, expect, it } from 'vitest'
import { formatAgentRowTypeLabel, formatAgentTypeLabel } from './agent-type-label'

describe('formatAgentRowTypeLabel', () => {
  it('names Gentle Shell for a Pi row whose session lives in its home', () => {
    expect(
      formatAgentRowTypeLabel({
        agentType: 'pi',
        entry: {
          providerSession: { transcriptPath: '/home/u/.gentle-shell/agent/sessions/s.jsonl' }
        }
      })
    ).toBe('Gentle Shell')
  })

  it('keeps stock Pi and other agents on their own names', () => {
    expect(
      formatAgentRowTypeLabel({
        agentType: 'pi',
        entry: { providerSession: { transcriptPath: '/home/u/.pi/agent/sessions/s.jsonl' } }
      })
    ).toBe('Pi')
    expect(formatAgentRowTypeLabel({ agentType: 'pi' })).toBe('Pi')
    expect(
      formatAgentRowTypeLabel({
        agentType: 'omp',
        entry: { providerSession: { transcriptPath: '/home/u/.gentle-shell/agent/s.jsonl' } }
      })
    ).toBe(formatAgentTypeLabel('omp'))
  })
})
