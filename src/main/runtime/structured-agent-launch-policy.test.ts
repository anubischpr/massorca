import { describe, expect, it } from 'vitest'
import { resolvedPiChatAccessMode } from './structured-agent-launch-support'

describe('Pi initial access policy', () => {
  it('preserves the restricted inherited policy and requires an explicit full-access choice', () => {
    const settings = { agentDefaultEnv: {}, agentDefaultArgs: { pi: '' } }
    expect(resolvedPiChatAccessMode(settings)).toBe('default')
    expect(resolvedPiChatAccessMode(settings, 'default')).toBe('default')
    expect(resolvedPiChatAccessMode(settings, 'full-access')).toBe('full-access')
    expect(settings.agentDefaultArgs.pi).toBe('')
  })
})
