import { describe, expect, it } from 'vitest'
import { readAgentSessionConnectorSnapshot } from './agent-session-connectors'
describe('session connector observation', () => {
  it('keeps status and redacted errors while excluding server configuration', () => {
    expect(
      readAgentSessionConnectorSnapshot({
        observedAt: 10,
        servers: [
          { name: 'mcp', status: 'failed', config: { url: 'private' }, error: 'token=veryprivate' }
        ]
      })
    ).toEqual({
      observedAt: 10,
      servers: [{ name: 'mcp', status: 'failed', error: 'token=[redacted]' }]
    })
  })
  it('keeps missing, malformed and empty distinct', () => {
    expect(readAgentSessionConnectorSnapshot(undefined)).toBeUndefined()
    expect(
      readAgentSessionConnectorSnapshot({ observedAt: Number.NaN, servers: [] })
    ).toBeUndefined()
    expect(
      readAgentSessionConnectorSnapshot({
        observedAt: 10,
        servers: [{ name: 'mcp', status: 'invented' }]
      })
    ).toBeUndefined()
    expect(readAgentSessionConnectorSnapshot({ observedAt: 10, servers: [] })).toEqual({
      observedAt: 10,
      servers: []
    })
  })
})
