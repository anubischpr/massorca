import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as NodeOs from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const home = vi.hoisted(() => ({ dir: '' }))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: () => home.dir }
})

import { createLocalCustomItemEnv } from './custom-item-env'

beforeEach(() => {
  home.dir = mkdtempSync(join(tmpdir(), 'orca-custom-home-'))
})

afterEach(() => {
  rmSync(home.dir, { recursive: true, force: true })
})

describe('createLocalCustomItemEnv', () => {
  it('keeps custom items in custom.json under the marketplace folder of the home directory', () => {
    const env = createLocalCustomItemEnv()
    expect(env.store.read()).toEqual([])
    env.store.write([])
    expect(existsSync(join(home.dir, '.orca', 'marketplace', 'custom.json'))).toBe(true)
  })
})
