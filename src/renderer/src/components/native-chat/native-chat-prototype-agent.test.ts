import { describe, expect, it, vi } from 'vitest'
import { prototypeAgentDisplayName, prototypeAgentForChat } from './native-chat-prototype-agent'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

describe('prototypeAgentForChat', () => {
  it.each([
    ['claude', 'unknown', 'claude'],
    ['codex', 'unknown', 'codex'],
    ['antigravity', 'unknown', 'antigravity'],
    ['pi', 'gentle-shell', 'gentle-shell'],
    ['pi', 'pi', 'other'],
    ['pi', 'unknown', 'other'],
    ['gemini', 'gentle-shell', 'other']
  ] as const)('maps %s on the %s runtime to %s', (agent, runtime, expected) => {
    expect(prototypeAgentForChat(agent, runtime)).toBe(expected)
  })
})

describe('prototypeAgentDisplayName', () => {
  it('names the Pi runtime for a Pi chat and the catalog label for any other agent', () => {
    expect(prototypeAgentDisplayName('pi', 'gentle-shell')).toBe('Gentle Shell')
    expect(prototypeAgentDisplayName('pi', 'pi')).toBe('Pi')
    expect(prototypeAgentDisplayName('codex', 'unknown')).toBe('Codex')
  })
})
