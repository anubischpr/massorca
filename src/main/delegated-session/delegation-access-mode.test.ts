import { describe, expect, it } from 'vitest'
import {
  agentSessionDeclaredAccess,
  type AgentSessionDeclaredAccess
} from '../../shared/agent-session-access-mode'
import { delegationChildAccessMode } from './delegation-access-mode'

const FULL = agentSessionDeclaredAccess({
  supportedAccessModes: ['default', 'full-access'],
  supportedPermissionPresets: ['plan', 'read-only']
}) as AgentSessionDeclaredAccess
function childMode(parentAccessMode: string | undefined, childAgent = 'codex') {
  return delegationChildAccessMode({
    childAgent,
    parentAccessMode,
    childDeclaredAccess: FULL
  })
}

describe('delegationChildAccessMode', () => {
  it('copies the parent’s own mode, whatever it is', () => {
    expect(childMode('read-only')).toBe('read-only')
    expect(childMode('plan')).toBe('plan')
    expect(childMode('default')).toBe('default')
    expect(childMode('full-access')).toBe('full-access')
  })

  it('asks for nothing when the parent follows the global setting', () => {
    expect(childMode(undefined)).toBeUndefined()
    expect(childMode('inherit')).toBeUndefined()
  })

  it('asks for nothing from a mode this build does not know, rather than guess a wider one', () => {
    expect(childMode('yolo')).toBeUndefined()
  })

  it('asks for nothing from an agent that declares no explicit modes', () => {
    // A protocol-driven (ACP) agent refuses an explicit mode outright.
    const asked = (childDeclaredAccess: AgentSessionDeclaredAccess | undefined) =>
      delegationChildAccessMode({
        childAgent: 'grok',
        parentAccessMode: 'read-only',
        childDeclaredAccess
      })
    expect(asked(undefined)).toBeUndefined()
    expect(asked({ modes: [], presets: [], explicit: [] })).toBeUndefined()
  })

  it('skips default for Pi, whose stock declaration omits it, and keeps every other mode', () => {
    expect(childMode('default', 'pi')).toBeUndefined()
    expect(childMode('full-access', 'pi')).toBe('full-access')
    expect(childMode('default', 'claude')).toBe('default')
  })

  it('never names a mode wider than the parent’s', () => {
    for (const parent of ['read-only', 'plan', 'default', 'auto', 'accept-edits', 'full-access']) {
      expect(childMode(parent)).toBe(parent)
    }
  })
})
