import { describe, expect, it } from 'vitest'
import type { NativeChatBlock, NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  mobileNativeChatRecordedFileCount,
  mobileNativeChatRecordedFiles
} from './mobile-native-chat-recorded-files'

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

describe('mobileNativeChatRecordedFiles', () => {
  it('lists each file once, keeping the latest write timestamp', () => {
    const at = (timestamp: number, messages: NativeChatMessage[]) =>
      messages.map((entry) => ({ ...entry, timestamp }))
    const files = mobileNativeChatRecordedFiles([
      ...at(1_000, write('index.html', 'c1')),
      ...at(5_000, write('notes.md', 'c2')),
      ...at(9_000, write('index.html', 'c3'))
    ])
    expect(files.map((file) => [file.path, file.timestamp])).toEqual([
      ['index.html', 9_000],
      ['notes.md', 5_000]
    ])
  })

  it('reports no timestamp when the transcript carried none', () => {
    expect(mobileNativeChatRecordedFiles(write('a.ts', 'c1'))).toEqual([
      { path: 'a.ts', timestamp: null, added: null, removed: null }
    ])
  })

  it('sums the line counts of landed edits that reported a diff', () => {
    const edit = (callId: string, newString: string): NativeChatMessage[] => [
      message(`${callId}-call`, [
        {
          type: 'tool-call',
          name: 'Edit',
          input: { file_path: 'src/a.ts', old_string: 'one', new_string: newString },
          callId,
          state: 'completed'
        }
      ]),
      message(`${callId}-result`, [{ type: 'tool-result', output: 'ok', callId, isError: false }])
    ]
    const [file] = mobileNativeChatRecordedFiles([...edit('e1', 'one\ntwo'), ...edit('e2', 'x')])
    expect(file).toMatchObject({ path: 'src/a.ts' })
    expect(file?.added).not.toBeNull()
  })
})
