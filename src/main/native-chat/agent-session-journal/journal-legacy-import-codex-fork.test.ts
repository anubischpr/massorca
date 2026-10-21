import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareLegacyTranscriptImport } from './journal-legacy-import'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function lines(records: unknown[]): string {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
}

function message(kind: 'user_message' | 'agent_message', text: string, at: string) {
  return { type: 'event_msg', timestamp: at, payload: { type: kind, message: text } }
}

describe('importing a forked Codex rollout', () => {
  it('reads the parent history the fork inherited, then the fork itself', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-codex-fork-'))
    roots.push(root)
    const day = join(root, 'sessions', '2026', '10', '21')
    await mkdir(day, { recursive: true })
    const parentPath = join(day, 'rollout-2026-10-21T10-00-00-parent-thread.jsonl')
    await writeFile(
      parentPath,
      lines([
        {
          type: 'session_meta',
          timestamp: '2026-10-21T10:00:00.000Z',
          payload: { id: 'parent-thread' }
        },
        message('user_message', 'first question', '2026-10-21T10:00:01.000Z'),
        message('agent_message', 'first answer', '2026-10-21T10:00:02.000Z')
      ])
    )
    const inherited = (await stat(parentPath)).size
    // Anything the parent wrote after the fork must not appear in the fork.
    await writeFile(
      parentPath,
      lines([
        {
          type: 'session_meta',
          timestamp: '2026-10-21T10:00:00.000Z',
          payload: { id: 'parent-thread' }
        },
        message('user_message', 'first question', '2026-10-21T10:00:01.000Z'),
        message('agent_message', 'first answer', '2026-10-21T10:00:02.000Z'),
        message('user_message', 'asked after the fork', '2026-10-21T10:05:00.000Z')
      ])
    )
    const childPath = join(day, 'rollout-2026-10-21T10-03-00-child-thread.jsonl')
    await writeFile(
      childPath,
      lines([
        {
          type: 'session_meta',
          timestamp: '2026-10-21T10:03:00.000Z',
          payload: {
            id: 'child-thread',
            forked_from_id: 'parent-thread',
            history_base: {
              thread_id: 'parent-thread',
              end_ordinal_exclusive: 3,
              end_byte_offset: inherited
            }
          }
        },
        message('user_message', 'asked in the fork', '2026-10-21T10:04:00.000Z')
      ])
    )

    const result = await prepareLegacyTranscriptImport({
      agent: 'codex',
      sessionId: 'child-thread',
      options: { filePath: childPath }
    })

    expect(result.ok).toBe(true)
    const texts = result.ok
      ? result.items.flatMap((item) =>
          item.body.kind === 'message'
            ? item.body.blocks.flatMap((block) => (block.type === 'text' ? [block.text] : []))
            : []
        )
      : []
    expect(texts).toEqual(['first question', 'first answer', 'asked in the fork'])
  })

  it('imports an ordinary rollout exactly as before', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-codex-plain-'))
    roots.push(root)
    const path = join(root, 'rollout-plain.jsonl')
    await writeFile(
      path,
      lines([
        { type: 'session_meta', timestamp: '2026-10-21T10:00:00.000Z', payload: { id: 'plain' } },
        message('user_message', 'hello', '2026-10-21T10:00:01.000Z')
      ])
    )
    const result = await prepareLegacyTranscriptImport({
      agent: 'codex',
      sessionId: 'plain',
      options: { filePath: path }
    })
    expect(result.ok && result.items).toHaveLength(1)
  })
})
