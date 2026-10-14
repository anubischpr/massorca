import { describe, expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import { antigravityTestProcess } from './structured-session-test-process'

describe('Antigravity structured-session test process', () => {
  it('installs a child pid and non-null streams without spawning a process', () => {
    const { managed } = antigravityTestProcess()

    expect(managed.child.pid).toBe(1234)
    expect(managed.child.stdin).toBeInstanceOf(PassThrough)
    expect(managed.child.stdout).toBeInstanceOf(PassThrough)
    expect(managed.child.stderr).toBeInstanceOf(PassThrough)
  })
})
