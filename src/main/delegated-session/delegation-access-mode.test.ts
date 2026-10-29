import { describe, expect, it } from 'vitest'
import {
  agentSessionDeclaredAccess,
  type AgentSessionDeclaredAccess
} from '../../shared/agent-session-access-mode'
import { delegationChildAccessMode } from './delegation-access-mode'

const FULL = declaredAccess()

function declaredAccess(): AgentSessionDeclaredAccess {
  const declared = agentSessionDeclaredAccess({
    supportedAccessModes: ['default', 'full-access'],
    supportedPermissionPresets: ['plan', 'read-only']
  })
  if (!declared) {
    throw new Error('the fixture declares access modes')
  }
  return declared
}
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

  it('refuses to start a child for a mode this build does not know, rather than guess a wider one', () => {
    expect(() => childMode('yolo')).toThrow('not one this version knows')
  })

  it('refuses an agent that declares no explicit modes unless the parent is unrestricted', () => {
    // A protocol-driven (ACP) agent refuses an explicit mode outright, so it cannot be held to one.
    const asked = (
      parentAccessMode: string,
      childDeclaredAccess: AgentSessionDeclaredAccess | undefined
    ) => delegationChildAccessMode({ childAgent: 'grok', parentAccessMode, childDeclaredAccess })
    const none = { modes: [], presets: [], explicit: [] } as const
    expect(() => asked('read-only', undefined)).toThrow('cannot be held to this chat')
    expect(() => asked('plan', none)).toThrow('cannot be held to this chat')
    expect(asked('full-access', undefined)).toBeUndefined()
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
