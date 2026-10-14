import { describe, expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import { antigravityTestProcess } from './structured-session-test-process'

describe('Antigravity structured-session test process', () => {
  it('installs a child pid and null-free streams without spawning a process', () => {
    const { managed } = antigravityTestProcess()
    const { child } = managed

    expect(child.pid).toBe(1234)
    expect(child.stdin).toBeInstanceOf(PassThrough)
    expect(child.stdout).toBeInstanceOf(PassThrough)
    expect(child.stderr).toBeInstanceOf(PassThrough)
    expect(child.stdio).toEqual([child.stdin, child.stdout, child.stderr, null, null])
  })
})
