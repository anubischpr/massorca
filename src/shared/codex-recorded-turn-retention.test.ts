import { MAX_RECORDED_CHILD_TURNS } from './codex-recorded-turn-configuration'
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCodexChildConfigurationReader } from './codex-subagent-transcript'

const directories: string[] = []
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
)
const context = (turn: string, model: string) => ({
  type: 'turn_context',
  timestamp: '2026-10-14T01:00:00Z',
  payload: { turn_id: turn, model, effort: 'medium' }
})
const jsonl = (rows: unknown[]) => `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`

describe('managed child turn retention', () => {
  it('bounds retained turns and never substitutes a retained turn for an evicted one', () => {
    const directory = mkdtempSync(join(tmpdir(), 'codex-turn-retention-bound-'))
    directories.push(directory)
    const parent = join(directory, 'rollout-parent.jsonl')
    writeFileSync(parent, '')
    writeFileSync(
      join(directory, 'rollout-child-child-one.jsonl'),
      jsonl(
        Array.from({ length: MAX_RECORDED_CHILD_TURNS + 1 }, (_, index) =>
          context(`turn-${index}`, `model-${index}`)
        )
      )
    )
    const read = createCodexChildConfigurationReader(parent)
    expect(read('child-one', `turn-${MAX_RECORDED_CHILD_TURNS}`)).toMatchObject({
      model: `model-${MAX_RECORDED_CHILD_TURNS}`
    })
    expect(read('child-one', 'turn-0')).toBeNull()
    expect(read('child-one', 'turn-1')).toMatchObject({ model: 'model-1' })
  })
  it('keeps preloaded future contexts without borrowing a different turn or child', () => {
    const directory = mkdtempSync(join(tmpdir(), 'codex-turn-retention-'))
    directories.push(directory)
    const parent = join(directory, 'rollout-parent.jsonl')
    writeFileSync(parent, jsonl([context('two', 'parent-model')]))
    writeFileSync(
      join(directory, 'rollout-child-child-one.jsonl'),
      jsonl([context('one', 'first-model'), context('two', 'future-model')])
    )
    writeFileSync(
      join(directory, 'rollout-child-child-two.jsonl'),
      jsonl([context('two', 'other-model')])
    )
    const read = createCodexChildConfigurationReader(parent)
    expect(read('child-one', 'one')).toMatchObject({ turnId: 'one', model: 'first-model' })
    expect(read('child-one', 'two')).toMatchObject({ turnId: 'two', model: 'future-model' })
    expect(read('child-one', 'missing')).toBeNull()
    expect(read('child-two', 'two')).toMatchObject({ model: 'other-model' })
    expect(read('child-one', 'two')).toMatchObject({ model: 'future-model' })
  })
})
