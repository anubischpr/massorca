import { describe, expect, it } from 'vitest'
import type { NativeChatBlock, NativeChatMessage } from '../../../src/shared/native-chat-types'
import { mobileNativeChatRecordedFileCount } from './mobile-native-chat-recorded-files'

function message(id: string, blocks: NativeChatBlock[], agentId?: string): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks,
    timestamp: null,
    source: 'transcript',
    ...(agentId ? { agentId } : {})
  }
}

/** A landed write of one path: its call, then the result that answers it. */
function write(path: string, callId: string, agentId?: string): NativeChatMessage[] {
  return [
    message(
      `${callId}-call`,
      [
        { type: 'tool-call', name: 'write_file', input: { Path: path }, callId, state: 'completed' }
      ],
      agentId
    ),
    message(
      `${callId}-result`,
      [{ type: 'tool-result', output: 'ok', callId, isError: false }],
      agentId
    )
  ]
}

describe('mobileNativeChatRecordedFileCount', () => {
  it('is zero when no call changed a file', () => {
    expect(
      mobileNativeChatRecordedFileCount([message('a', [{ type: 'text', text: 'Just talking' }])])
    ).toBe(0)
  })

  it('counts each distinct changed file once', () => {
    expect(
      mobileNativeChatRecordedFileCount([
        ...write('src/a.ts', 'c1'),
        ...write('src/b.ts', 'c2'),
        ...write('src/a.ts', 'c3')
      ])
    ).toBe(2)
  })

  it('leaves out files changed by a subagent', () => {
    expect(
      mobileNativeChatRecordedFileCount([
        ...write('src/a.ts', 'c1'),
        ...write('src/child.ts', 'c2', 'agent-1')
      ])
    ).toBe(1)
  })
})
