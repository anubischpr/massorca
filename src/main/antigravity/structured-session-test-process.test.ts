import { expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import { antigravityTestProcess } from './structured-session-test-process'

it('creates a child fixture with its PID and null-free streams installed', () => {
  const { managed } = antigravityTestProcess()
  const { child } = managed

  expect(child.pid).toBe(1234)
  expect(child.stdin).toBeInstanceOf(PassThrough)
  expect(child.stdout).toBeInstanceOf(PassThrough)
  expect(child.stderr).toBeInstanceOf(PassThrough)
  expect(child.stdio).toEqual([child.stdin, child.stdout, child.stderr, null, null])
})
