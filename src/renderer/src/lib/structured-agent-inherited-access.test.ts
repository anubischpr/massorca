import { describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { structuredAgentInheritedAccess } from './structured-agent-inherited-access'

describe('structuredAgentInheritedAccess', () => {
  const settings = useAppStore.getState().settings!

  it('resolves inherit to full access when the global default args bypass permissions', () => {
    expect(
      structuredAgentInheritedAccess(
        'claude',
        { kind: 'local' },
        { ...settings, agentDefaultArgs: { claude: '--dangerously-skip-permissions' } }
      )
    ).toBe('full-access')
  })

  it('resolves inherit to the restricted default when the user chose manual arguments', () => {
    // An untouched field falls back to the bypass default, so only an explicit empty string opts out.
    expect(
      structuredAgentInheritedAccess(
        'claude',
        { kind: 'local' },
        { ...settings, agentDefaultArgs: { claude: '' } }
      )
    ).toBe('default')
  })

  it('knows nothing of a chat on another host, or of settings not yet loaded', () => {
    expect(
      structuredAgentInheritedAccess(
        'claude',
        { kind: 'environment', environmentId: 'server-1' },
        settings
      )
    ).toBeNull()
    expect(structuredAgentInheritedAccess('claude', { kind: 'local' }, null)).toBeNull()
  })

  it('knows nothing for a value that is not an agent', () => {
    expect(structuredAgentInheritedAccess('not-an-agent', { kind: 'local' }, settings)).toBeNull()
  })
})
