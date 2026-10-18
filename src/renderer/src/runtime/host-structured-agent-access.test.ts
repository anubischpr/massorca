import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionRegisteredAgent } from '../../../shared/agent-session-registered-agents'

const readHostStructuredAgentsForRuntime = vi.hoisted(() => vi.fn())
vi.mock('./host-structured-agents', () => ({ readHostStructuredAgentsForRuntime }))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ runtimeStatusByEnvironmentId: new Map() }) }
}))

import { accessRuntimeDeclaredByHost } from './host-structured-agent-access'

const PI_BASE = {
  rewind: false,
  compact: true,
  threadGoal: false,
  contextUsage: true,
  imagePrompts: true,
  steering: 'inject',
  approvalEnforcement: 'provider',
  supportedAccessModes: ['full-access']
} as const

function listed(runtimeAccess?: AgentSessionRegisteredAgent['capabilities']['runtimeAccess']) {
  readHostStructuredAgentsForRuntime.mockReturnValue([
    { agent: 'pi', capabilities: { ...PI_BASE, ...(runtimeAccess ? { runtimeAccess } : {}) } }
  ])
}

describe('accessRuntimeDeclaredByHost', () => {
  beforeEach(() => readHostStructuredAgentsForRuntime.mockReset())

  it('names Gentle Shell only when the host declares access for it', () => {
    listed({ 'gentle-shell': { modes: ['default', 'full-access'], presets: ['auto'] } })
    expect(accessRuntimeDeclaredByHost({ kind: 'local' }, 'pi', 'gentle-shell')).toBe(
      'gentle-shell'
    )
  })

  it('treats a host that predates the declaration as full access only, so a create stays legacy', () => {
    listed()
    expect(accessRuntimeDeclaredByHost({ kind: 'local' }, 'pi', 'gentle-shell')).toBeUndefined()
  })

  it('names nothing before the host has listed its agents or without a runtime', () => {
    readHostStructuredAgentsForRuntime.mockReturnValue(undefined)
    expect(accessRuntimeDeclaredByHost({ kind: 'local' }, 'pi', 'gentle-shell')).toBeUndefined()
    listed({ 'gentle-shell': { modes: ['default'] } })
    expect(accessRuntimeDeclaredByHost({ kind: 'local' }, 'pi', undefined)).toBeUndefined()
  })
})
