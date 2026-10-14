import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { nativeChatBackgroundCommandDetails } from './native-chat-background-command-details'

function view(id: string, changes: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    kind: 'command',
    state: 'working',
    membership: 'live',
    firstObservedAt: 1,
    observedAt: 2,
    stoppable: false,
    invocation: { invocationId: id, generation: 1 },
    ...changes
  }
}
function item(id: string, agentId?: string): AgentJournalRenderItem {
  return {
    itemId: id,
    revision: 1,
    sequence: 1,
    observedAt: 2,
    ...(agentId ? { agentId } : {}),
    body: {
      kind: 'tool-call',
      name: 'shell',
      callId: 'same',
      input: { command: 'printf proof' },
      state: 'running',
      output: { head: id, byteLength: id.length, digest: 'd', truncated: false }
    }
  }
}
const main = view('main', { ownership: 'main', providerId: 'codex-command:primary:same' })
const agent = view('worker', { kind: 'agent', providerId: 'child-thread' })
const child = view('child', {
  ownership: 'child',
  parentChildWorkId: 'worker',
  providerId: 'codex-command:thread:child-thread:same'
})

describe('background command journal details', () => {
  it('isolates the same call id by authoritative producer', () => {
    const items = [
      item('root-output'),
      item('child-output', 'child-thread'),
      item('other', 'other-thread')
    ]
    expect(nativeChatBackgroundCommandDetails(main, [agent], items)?.result?.output).toBe(
      'root-output'
    )
    expect(nativeChatBackgroundCommandDetails(child, [agent], items)?.result?.output).toBe(
      'child-output'
    )
  })
  it('never guesses missing or unverifiable ownership', () => {
    expect(
      nativeChatBackgroundCommandDetails({ ...main, ownership: undefined }, [], [item('root')])
    ).toBeNull()
    expect(
      nativeChatBackgroundCommandDetails(child, [], [item('child', 'child-thread')])
    ).toBeNull()
  })
  it('refuses ambiguous duplicate journal identities', () => {
    expect(nativeChatBackgroundCommandDetails(main, [], [item('a'), item('b')])).toBeNull()
  })
  it('projects actual completion, output revision and truncation', () => {
    const completed = item('root')
    completed.body = {
      kind: 'tool-call',
      name: 'shell',
      callId: 'same',
      input: { command: 'printf proof' },
      state: 'completed',
      exitCode: 0,
      durationMs: 12,
      output: { head: 'received head', byteLength: 500, digest: 'd', truncated: true }
    }
    const detail = nativeChatBackgroundCommandDetails(main, [], [completed])
    expect(detail?.call).toMatchObject({ state: 'completed', exitCode: 0, durationMs: 12 })
    expect(detail?.result?.output).toBe('received head\n… (500 bytes)')
  })
  it('does not manufacture output when the host has none', () => {
    const running = item('root')
    if (running.body.kind === 'tool-call') {
      delete running.body.output
    }
    expect(nativeChatBackgroundCommandDetails(main, [], [running])?.result).toBeUndefined()
  })
})
