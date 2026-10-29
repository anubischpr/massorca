import { describe, expect, it } from 'vitest'
import { decideWorkerStartMode } from './orchestration-worker-start-mode'

const TERMINAL_DEFAULT = { experimentalNativeChat: false }

describe('worker-start preferredMode', () => {
  it('asks for a structured chat over a terminal default', () => {
    expect(
      decideWorkerStartMode({
        params: { agent: 'claude', preferredMode: 'chat' },
        settings: TERMINAL_DEFAULT
      })
    ).toMatchObject({ mode: 'structured', preferred: 'terminal', reason: 'caller_requested_chat' })
  })

  it('does not ask for a chat when the request is absent', () => {
    expect(
      decideWorkerStartMode({ params: { agent: 'claude' }, settings: TERMINAL_DEFAULT })
    ).toMatchObject({ mode: 'terminal', reason: 'user_default' })
  })

  it('still needs feasibility: a remote server runs a terminal even when a chat is asked', () => {
    expect(
      decideWorkerStartMode({
        params: { agent: 'claude', on: 'server-1', preferredMode: 'chat' },
        settings: TERMINAL_DEFAULT
      })
    ).toMatchObject({ mode: 'terminal', reason: 'remote_execution_host' })
  })

  it('still needs feasibility: a reused terminal cannot become a chat', () => {
    expect(
      decideWorkerStartMode({
        params: { agent: 'claude', terminal: 'term_1', preferredMode: 'chat' },
        settings: TERMINAL_DEFAULT
      })
    ).toMatchObject({ mode: 'terminal', reason: 'reused_terminal' })
  })

  it('still needs feasibility: an agent with no structured registration stays a terminal', () => {
    expect(
      decideWorkerStartMode({
        params: { agent: 'cursor', preferredMode: 'chat' },
        settings: TERMINAL_DEFAULT
      })
    ).toMatchObject({ mode: 'terminal', reason: 'agent_without_structured_session' })
  })
})
