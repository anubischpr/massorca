import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { antigravityTranscriptPathsForConversation } from './session-scanner-antigravity-paths'

describe('antigravityTranscriptPathsForConversation', () => {
  it('names the conversation transcript under every brain origin of one home', () => {
    const transcript = (origin: string): string =>
      join(
        '/home/ada',
        '.gemini',
        origin,
        'brain',
        'conv-1',
        '.system_generated',
        'logs',
        'transcript.jsonl'
      )
    expect(antigravityTranscriptPathsForConversation('conv-1', '/home/ada')).toEqual([
      transcript('antigravity-cli'),
      transcript('antigravity-ide'),
      transcript('antigravity')
    ])
  })

  it.each(['', '.', '..', 'a/b', 'a\\b'])('never builds a path from the unsafe id %j', (id) => {
    expect(antigravityTranscriptPathsForConversation(id, '/home/ada')).toEqual([])
  })
})
