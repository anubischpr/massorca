import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeAntigravityTranscriptLine } from './transcript-line-decoders'

const FIXTURE_PATH = fileURLToPath(
  new URL('./fixtures/antigravity-transcript.scrubbed.jsonl', import.meta.url)
)

function decodeFixture(): ReturnType<typeof decodeAntigravityTranscriptLine>[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => decodeAntigravityTranscriptLine(line, `fb-${index}`))
}

describe('decodeAntigravityTranscriptLine', () => {
  it('decodes a scrubbed real transcript into assistant turns and tool results only', () => {
    const decoded = decodeFixture()
    const roles = decoded.map((message) => message?.role ?? null)
    // SYSTEM_MESSAGE (row 0) is environment context, not a conversation turn.
    expect(roles[0]).toBeNull()
    expect(roles.filter((role) => role === 'assistant').length).toBeGreaterThan(0)
    expect(roles.filter((role) => role === 'tool').length).toBeGreaterThan(0)
    expect(roles.filter((role) => role === 'user')).toEqual([])
    expect(decoded.every((message) => message === null || message.source === 'transcript')).toBe(
      true
    )
  })

  it('maps planner tool calls to tool-call blocks with unquoted arguments', () => {
    const line = JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: '2026-10-13T21:50:06Z',
      content: 'Reviewing the schema.',
      tool_calls: [
        {
          name: 'view_file',
          args: { AbsolutePath: '"/home/user/project/schema.json"', toolAction: '"Reading schema"' }
        }
      ]
    })
    expect(decodeAntigravityTranscriptLine(line, 'fb-1')).toEqual({
      id: 'fb-1',
      role: 'assistant',
      blocks: [
        { type: 'text', text: 'Reviewing the schema.' },
        {
          type: 'tool-call',
          name: 'view_file',
          input: { AbsolutePath: '/home/user/project/schema.json', toolAction: 'Reading schema' }
        }
      ],
      timestamp: Date.parse('2026-10-13T21:50:06Z'),
      source: 'transcript'
    })
  })

  it('unwraps the user request envelope from USER_INPUT rows', () => {
    const line = JSON.stringify({
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-10-13T21:50:05Z',
      content: '<USER_REQUEST>\nRevisa el harness\n</USER_REQUEST>'
    })
    expect(decodeAntigravityTranscriptLine(line, 'fb-0')).toEqual({
      id: 'fb-0',
      role: 'user',
      blocks: [{ type: 'text', text: 'Revisa el harness' }],
      timestamp: Date.parse('2026-10-13T21:50:05Z'),
      source: 'transcript'
    })
  })

  it('strips the tool runner header from outputs and flags failed tool rows', () => {
    const ok = JSON.stringify({
      step_index: 2,
      source: 'MODEL',
      type: 'GENERIC',
      status: 'DONE',
      created_at: '2026-10-13T21:50:11Z',
      content: 'Created At: 2026-10-13T21:50:11Z\nCompleted At: 2026-10-13T21:50:12Z\nfile body'
    })
    expect(decodeAntigravityTranscriptLine(ok, 'fb-2')).toMatchObject({
      role: 'tool',
      blocks: [{ type: 'tool-result', output: 'file body' }]
    })
    expect(decodeAntigravityTranscriptLine(ok, 'fb-2')).not.toHaveProperty('blocks.0.isError')

    const failed = JSON.stringify({
      step_index: 10,
      source: 'MODEL',
      type: 'GENERIC',
      status: 'ERROR',
      error: 'permission check failed',
      created_at: '2026-10-13T21:53:43Z',
      content: 'Created At: 2026-10-13T21:53:43Z\nCompleted At: 2026-10-13T21:53:45Z\nEnd'
    })
    expect(decodeAntigravityTranscriptLine(failed, 'fb-10')).toMatchObject({
      role: 'tool',
      blocks: [{ type: 'tool-result', output: 'End', isError: true }]
    })
  })

  it('skips environment, checkpoint, and malformed rows without throwing', () => {
    const checkpoint = JSON.stringify({
      step_index: 236,
      source: 'SYSTEM',
      type: 'CHECKPOINT',
      status: 'DONE',
      content: '# Resuming from a compaction'
    })
    expect(decodeAntigravityTranscriptLine(checkpoint, 'fb-c')).toBeNull()
    expect(decodeAntigravityTranscriptLine('{not json', 'fb-bad')).toBeNull()
    expect(decodeAntigravityTranscriptLine('', 'fb-empty')).toBeNull()
  })
})
