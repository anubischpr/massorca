import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))

import { BOT_TEAM_LOCAL_HOST, botTeamHostTarget, resolveBotTeamHost } from './bot-team-host'

describe('resolveBotTeamHost', () => {
  it('uses the paired server by default, so a phone paired with it sees the same teams', () => {
    expect(
      resolveBotTeamHost({ chosen: null, activeEnvironmentId: null, environmentIds: ['vps'] })
    ).toBe('vps')
  })

  it('uses this computer when no server is paired', () => {
    expect(resolveBotTeamHost({ chosen: null, activeEnvironmentId: '', environmentIds: [] })).toBe(
      BOT_TEAM_LOCAL_HOST
    )
  })

  it('prefers the active server over other paired ones', () => {
    expect(
      resolveBotTeamHost({ chosen: null, activeEnvironmentId: 'b', environmentIds: ['a', 'b'] })
    ).toBe('b')
  })

  it('keeps the choice of this computer, which holds teams made before this existed', () => {
    expect(
      resolveBotTeamHost({
        chosen: BOT_TEAM_LOCAL_HOST,
        activeEnvironmentId: null,
        environmentIds: ['vps']
      })
    ).toBe(BOT_TEAM_LOCAL_HOST)
  })

  it('ignores a chosen server that is no longer paired', () => {
    expect(
      resolveBotTeamHost({ chosen: 'gone', activeEnvironmentId: null, environmentIds: ['vps'] })
    ).toBe('vps')
  })
})

describe('botTeamHostTarget', () => {
  it('maps a host to its RPC target', () => {
    expect(botTeamHostTarget(BOT_TEAM_LOCAL_HOST)).toEqual({ kind: 'local' })
    expect(botTeamHostTarget('vps')).toEqual({ kind: 'environment', environmentId: 'vps' })
  })
})
