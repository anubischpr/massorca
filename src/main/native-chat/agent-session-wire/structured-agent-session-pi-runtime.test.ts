import { describe, expect, it } from 'vitest'
import { structuredAgentSessionGentleShellMarker } from './structured-agent-session-pi-runtime'

describe('structuredAgentSessionGentleShellMarker', () => {
  it('marks only a Pi record launched on Gentle Shell', () => {
    expect(
      structuredAgentSessionGentleShellMarker({
        provider: 'pi',
        options: { piRuntime: 'gentle-shell' }
      })
    ).toBe('gentle-shell')
    expect(
      structuredAgentSessionGentleShellMarker({ provider: 'pi', options: { piRuntime: 'pi' } })
    ).toBeUndefined()
    expect(structuredAgentSessionGentleShellMarker({ provider: 'pi', options: {} })).toBeUndefined()
    expect(
      structuredAgentSessionGentleShellMarker({
        provider: 'claude',
        options: { piRuntime: 'gentle-shell' }
      })
    ).toBeUndefined()
    expect(structuredAgentSessionGentleShellMarker(null)).toBeUndefined()
  })
})
