import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { mobileChatTurnArtifactCards } from './mobile-chat-turn-artifacts'

function user(id: string): NativeChatMessage {
  return {
    id,
    role: 'user',
    blocks: [{ type: 'text', text: 'go' }],
    timestamp: 1,
    source: 'transcript'
  }
}

function assistant(id: string, text: string): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [{ type: 'text', text }],
    timestamp: 2,
    source: 'transcript'
  }
}

function wrote(id: string, path: string): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [
      {
        type: 'tool-call',
        name: 'write_file',
        input: { Path: path },
        callId: id,
        state: 'completed'
      }
    ],
    timestamp: 3,
    source: 'transcript'
  }
}

describe('mobileChatTurnArtifactCards', () => {
  it('places a card after the last message of a turn that wrote an HTML page', () => {
    const cards = mobileChatTurnArtifactCards([
      user('u1'),
      wrote('w1', 'C:/work/usage.html'),
      assistant('a1', 'Done.')
    ])
    expect([...cards.keys()]).toEqual(['a1'])
    expect(cards.get('a1')?.map((page) => page.name)).toEqual(['usage.html'])
  })

  it('places a card for a visual the turn showed, and keys it to that turn only', () => {
    const cards = mobileChatTurnArtifactCards([
      user('u1'),
      assistant('a1', 'Here.\n::orca-visual{file="chart.html"}'),
      user('u2'),
      assistant('a2', 'Plain answer.')
    ])
    expect([...cards.keys()]).toEqual(['a1'])
    expect(cards.get('a1')?.[0].target).toEqual({ kind: 'visual', file: 'chart.html' })
  })

  it('draws no card for a turn with only Markdown writes', () => {
    const cards = mobileChatTurnArtifactCards([
      user('u1'),
      wrote('w1', 'C:/work/notes.md'),
      assistant('a1', 'Noted.')
    ])
    expect(cards.size).toBe(0)
  })
})
