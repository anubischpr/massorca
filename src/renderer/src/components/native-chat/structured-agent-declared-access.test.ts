import { describe, expect, it } from 'vitest'
import {
  createStructuredAgentSessionOptionState,
  structuredAgentSessionOptionSnapshot
} from '../../../../shared/structured-agent-session-options'
import {
  accessPickBlockedByProvider,
  lockAccessWhileProviderRuns
} from './structured-agent-declared-access'

const state = {
  ...createStructuredAgentSessionOptionState('claude', null, ['default', 'full-access'], ['auto']),
  accessModeSettable: false
}
const enabled = (snapshot: ReturnType<typeof structuredAgentSessionOptionSnapshot>) =>
  snapshot
    .filter((entry) => entry.id === 'accessMode' && entry.settable)
    .flatMap((entry) => (entry.kind.type === 'select' ? entry.kind.choices : []))
    .filter((choice) => choice.disabled !== true)
    .map((choice) => choice.value)

describe('access picks while the provider runs', () => {
  it('enables a pick the running child already satisfies beside the live modes', () => {
    const withRecordOnly = {
      ...state,
      liveAccessModes: ['auto' as const],
      recordOnlyAccessModes: ['full-access' as const]
    }
    const locked = lockAccessWhileProviderRuns(
      structuredAgentSessionOptionSnapshot(withRecordOnly),
      { providerRunning: true },
      withRecordOnly
    )
    expect(enabled(locked)).toEqual(['auto', 'full-access'])
    expect(
      accessPickBlockedByProvider({ providerRunning: true }, withRecordOnly, 'full-access')
    ).toBe(false)
    expect(accessPickBlockedByProvider({ providerRunning: true }, withRecordOnly, 'default')).toBe(
      true
    )
  })

  it('blocks every pick while the provider is still starting', () => {
    const withRecordOnly = { ...state, recordOnlyAccessModes: ['full-access' as const] }
    expect(
      accessPickBlockedByProvider({ providerStarting: true }, withRecordOnly, 'full-access')
    ).toBe(true)
    expect(
      enabled(
        lockAccessWhileProviderRuns(
          structuredAgentSessionOptionSnapshot(withRecordOnly),
          { providerStarting: true },
          withRecordOnly
        )
      )
    ).toEqual([])
  })
})
