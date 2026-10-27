import { describe, expect, it } from 'vitest'
import type { NativeChatBlock, NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  buildMobileChatSummaryModel,
  chatConnectors,
  chatModelLabel,
  chatStatusLine,
  chatTitleFromMessages,
  formatWorkingElapsed,
  runningSubagents
} from './mobile-chat-summary-model'

function message(
  id: string,
  role: NativeChatMessage['role'],
  blocks: NativeChatBlock[],
  extra: Partial<NativeChatMessage> = {}
): NativeChatMessage {
  return { id, role, blocks, timestamp: null, source: 'transcript', ...extra }
}

function toolCall(name: string, callId: string): NativeChatBlock {
  return { type: 'tool-call', name, input: {}, callId, state: 'completed' }
}

function writeOf(path: string, callId: string): NativeChatMessage[] {
  return [
    message(`${callId}-call`, 'assistant', [
      {
        type: 'tool-call',
        name: 'Edit',
        input: { file_path: path, old_string: 'a', new_string: 'b' },
        callId,
        state: 'completed'
      }
    ]),
    message(`${callId}-result`, 'assistant', [
      { type: 'tool-result', output: 'ok', callId, isError: false }
    ])
  ]
}

describe('formatWorkingElapsed', () => {
  it('reads m:ss under an hour and h:mm:ss from there', () => {
    expect(formatWorkingElapsed(0)).toBe('0:00')
    expect(formatWorkingElapsed(83_000)).toBe('1:23')
    expect(formatWorkingElapsed(3_723_000)).toBe('1:02:03')
  })

  it('reads a negative span as zero', () => {
    expect(formatWorkingElapsed(-5_000)).toBe('0:00')
  })
})

describe('chatStatusLine', () => {
  it('says Idle when no turn runs', () => {
    expect(chatStatusLine({ working: false, workingStartedAt: 1, now: 9_000 })).toEqual({
      working: false,
      label: 'Idle'
    })
  })

  it('counts the working time from the turn start', () => {
    expect(chatStatusLine({ working: true, workingStartedAt: 1_000, now: 84_000 })).toEqual({
      working: true,
      label: 'Working · 1:23'
    })
  })

  it('says Working without a clock when the host gave no start', () => {
    expect(chatStatusLine({ working: true, workingStartedAt: null, now: 9_000 })).toEqual({
      working: true,
      label: 'Working'
    })
  })
})

describe('chatModelLabel', () => {
  it('reads the model that answered last', () => {
    expect(
      chatModelLabel([
        message('a', 'assistant', [{ type: 'text', text: 'one' }], { model: 'model-a' }),
        message('b', 'user', [{ type: 'text', text: 'two' }]),
        message('c', 'assistant', [{ type: 'text', text: 'three' }], { model: 'model-b' })
      ])
    ).toBe('model-b')
  })

  it('is null when no row names a model', () => {
    expect(chatModelLabel([message('a', 'user', [{ type: 'text', text: 'hi' }])])).toBeNull()
  })
})

describe('chatTitleFromMessages', () => {
  it('uses the first prompt collapsed to one line', () => {
    expect(
      chatTitleFromMessages([
        message('a', 'user', [{ type: 'text', text: '  Fix the\n  login   bug ' }])
      ])
    ).toBe('Fix the login bug')
  })

  it('cuts a long prompt with an ellipsis', () => {
    const title = chatTitleFromMessages([
      message('a', 'user', [{ type: 'text', text: 'x'.repeat(200) }])
    ])
    expect(title?.endsWith('…')).toBe(true)
    expect(title?.length).toBe(60)
  })

  it('skips subagent prompts and returns null with no prompt', () => {
    expect(
      chatTitleFromMessages([
        message('a', 'user', [{ type: 'text', text: 'child prompt' }], { agentId: 'child' })
      ])
    ).toBeNull()
  })
})

describe('chatConnectors', () => {
  it('lists each MCP server once, in first-use order', () => {
    expect(
      chatConnectors([
        message('a', 'assistant', [
          toolCall('mcp__github__create_issue', 'c1'),
          toolCall('mcp__claude_ai_Gmail__search', 'c2'),
          toolCall('Bash', 'c3')
        ]),
        message('b', 'assistant', [toolCall('mcp__github__list_prs', 'c4')])
      ])
    ).toEqual([
      { id: 'github', label: 'github' },
      { id: 'claude_ai_Gmail', label: 'claude_ai_Gmail' }
    ])
  })

  it('leaves out connector calls a subagent made', () => {
    expect(
      chatConnectors([
        message('a', 'assistant', [toolCall('mcp__github__list_prs', 'c1')], { agentId: 'child' })
      ])
    ).toEqual([])
  })
})

describe('runningSubagents', () => {
  it('keeps children whose latest report says working', () => {
    const roster = (
      agents: Array<{ id: string; label: string; state: 'working' | 'completed' }>
    ): NativeChatBlock => ({ type: 'subagent-group', groupId: 'g1', agents })
    expect(
      runningSubagents([
        message('a', 'assistant', [
          roster([
            { id: 'c1', label: 'Explore', state: 'working' },
            { id: 'c2', label: 'Review', state: 'working' }
          ])
        ]),
        message('b', 'assistant', [roster([{ id: 'c1', label: 'Explore', state: 'completed' }])])
      ])
    ).toEqual([{ id: 'c2', label: 'Review' }])
  })
})

describe('buildMobileChatSummaryModel', () => {
  it('gathers the sections the summary shows', () => {
    const writes = Array.from({ length: 8 }, (_, index) =>
      writeOf(`out/file-${index}.ts`, `w${index}`)
    ).flat()
    const model = buildMobileChatSummaryModel({
      messages: [message('p', 'user', [{ type: 'text', text: 'Write files' }]), ...writes]
    })
    expect(model.title).toBe('Write files')
  })
})
