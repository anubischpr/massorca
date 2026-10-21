import { describe, expect, it } from 'vitest'
import { nativeChatStatusFacts } from './native-chat-status-facts'

describe('the facts /status reports', () => {
  it('names the chat and its folder, and says what the chat does not hold', () => {
    const facts = nativeChatStatusFacts({
      agent: 'codex',
      sessionId: 'chat-status-1',
      workspacePath: 'C:/work/orca',
      snapshot: [],
      context: null
    })
    expect(facts.map((fact) => fact.label)).toEqual([
      'Agent',
      'Model',
      'Reasoning effort',
      'Access',
      'Workspace',
      'Chat session',
      'Context'
    ])
    expect(facts.find((fact) => fact.label === 'Workspace')?.value).toBe('C:/work/orca')
    expect(facts.find((fact) => fact.label === 'Chat session')?.value).toBe('chat-status-1')
    expect(facts.find((fact) => fact.label === 'Model')?.value).toBe('Not reported')
    expect(facts.find((fact) => fact.label === 'Context')?.value).toBe('Not reported')
  })
})
