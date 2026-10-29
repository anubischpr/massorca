import { describe, expect, it } from 'vitest'
import { WorkerStartParams } from './orchestration-worker-start-params'

const LEGACY = { from: 'term_coordinator', task: 'task_1', agent: 'claude' }

describe('WorkerStartParams structured options', () => {
  it('parses an older client unchanged and adds neither new field', () => {
    const parsed = WorkerStartParams.parse(LEGACY)
    expect(parsed).toEqual(LEGACY)
    expect(parsed).not.toHaveProperty('preferredMode')
    expect(parsed).not.toHaveProperty('accessMode')
  })

  it('accepts a chat preference and every access mode the chat itself can pick', () => {
    expect(WorkerStartParams.parse({ ...LEGACY, preferredMode: 'chat' })).toMatchObject({
      preferredMode: 'chat'
    })
    for (const accessMode of ['inherit', 'default', 'full-access', 'auto', 'read-only']) {
      expect(WorkerStartParams.parse({ ...LEGACY, accessMode })).toMatchObject({ accessMode })
    }
  })

  it('refuses a mode that is not a chat preference or a known access mode', () => {
    expect(() => WorkerStartParams.parse({ ...LEGACY, preferredMode: 'terminal' })).toThrow()
    expect(() => WorkerStartParams.parse({ ...LEGACY, accessMode: 'bypass' })).toThrow()
  })
})
