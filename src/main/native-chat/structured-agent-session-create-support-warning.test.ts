import { afterEach, describe, expect, it, vi } from 'vitest'

const span = vi.hoisted(() => ({ fail: vi.fn() }))
const startSpan = vi.hoisted(() => vi.fn(() => span))
vi.mock('../observability/tracer', () => ({ startSpan }))

import { warnStructuredAgentSessionCreateUnsupported } from './structured-agent-session-create-support'

afterEach(() => {
  vi.restoreAllMocks()
  startSpan.mockClear()
  span.fail.mockClear()
})

describe('warnStructuredAgentSessionCreateUnsupported', () => {
  it('writes the refusal and its cause to the trace as well as the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnStructuredAgentSessionCreateUnsupported(
      'pi',
      { supported: false, reason: 'agent', cause: 'cliMissing' },
      'installed-agent'
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason agent, cause cliMissing'))
    expect(startSpan).toHaveBeenCalledWith('agentSession.createSupport', {
      attributes: { agent: 'pi', check: 'installed-agent', reason: 'agent', cause: 'cliMissing' }
    })
    expect(span.fail).toHaveBeenCalledOnce()
  })

  it('stays silent for a supported verdict', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnStructuredAgentSessionCreateUnsupported('pi', { supported: true }, 'installed-agent')
    expect(warn).not.toHaveBeenCalled()
    expect(startSpan).not.toHaveBeenCalled()
  })
})
