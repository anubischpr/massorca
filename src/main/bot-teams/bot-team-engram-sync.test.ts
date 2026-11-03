import { describe, expect, it, vi } from 'vitest'
import type { EngramRun, EngramRunner } from './bot-team-engram-reader'
import {
  createEngramCloudSync,
  ENGRAM_IMPORT_TIMEOUT_MS,
  ENGRAM_SYNC_INTERVAL_MS
} from './bot-team-engram-sync'

const IMPORT_ARGS = ['sync', '--import', '--cloud', '--project', 'massorca']
const IMPORTED: EngramRun = {
  code: 0,
  stdout: 'Update available: 3.3.2 -> 3.6.0\nImported 62 chunks\n',
  timedOut: false
}

function clock(start = 1_000_000) {
  let at = start
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms
    }
  }
}

describe('createEngramCloudSync', () => {
  it('runs the cloud import for the project as argv with a 120 s timeout', async () => {
    const run = vi.fn(async () => IMPORTED)
    const sync = createEngramCloudSync({ now: clock().now })
    expect(await sync.refresh(run, 'massorca', { force: false })).toBe(false)
    expect(run).toHaveBeenCalledWith(IMPORT_ARGS, { timeoutMs: 120_000 })
    expect(ENGRAM_IMPORT_TIMEOUT_MS).toBe(120_000)
  })

  it('reports whether an import is running, and whether the last settled one failed', async () => {
    let finish!: (result: EngramRun) => void
    const run = vi.fn(
      () =>
        new Promise<EngramRun>((resolve) => {
          finish = resolve
        })
    )
    const sync = createEngramCloudSync({ now: clock().now })
    expect(sync.status('massorca')).toEqual({ importing: false, failed: false })
    void sync.refresh(run, 'massorca', { force: false })
    expect(sync.status('massorca')).toEqual({ importing: true, failed: false })
    finish({ code: 1, stdout: '', timedOut: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sync.status('massorca')).toEqual({ importing: false, failed: true })
  })

  it('skips the import until five minutes have passed for the same project', async () => {
    const time = clock()
    const run = vi.fn(async () => IMPORTED)
    const sync = createEngramCloudSync({ now: time.now })
    expect(ENGRAM_SYNC_INTERVAL_MS).toBe(5 * 60_000)
    await sync.refresh(run, 'massorca', { force: false })
    time.advance(ENGRAM_SYNC_INTERVAL_MS - 1)
    await sync.refresh(run, 'massorca', { force: false })
    expect(run).toHaveBeenCalledTimes(1)
    time.advance(1)
    await sync.refresh(run, 'massorca', { force: false })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('keeps the throttle separate for each project', async () => {
    const run = vi.fn(async () => IMPORTED)
    const sync = createEngramCloudSync({ now: clock().now })
    await sync.refresh(run, 'massorca', { force: false })
    await sync.refresh(run, 'demo', { force: false })
    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenLastCalledWith(['sync', '--import', '--cloud', '--project', 'demo'], {
      timeoutMs: 120_000
    })
  })

  it('runs again when forced, but never two imports for one project at once', async () => {
    let finish!: (result: EngramRun) => void
    const run = vi.fn(
      () =>
        new Promise<EngramRun>((resolve) => {
          finish = resolve
        })
    )
    const sync = createEngramCloudSync({ now: clock().now })
    const first = sync.refresh(run, 'massorca', { force: false })
    const second = sync.refresh(run, 'massorca', { force: true })
    expect(run).toHaveBeenCalledTimes(1)
    finish(IMPORTED)
    expect(await Promise.all([first, second])).toEqual([false, false])
    const again = sync.refresh(run, 'massorca', { force: true })
    finish(IMPORTED)
    expect(await again).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('reports a failed import for a non-zero exit, a timeout, an old CLI usage text, or a start error', async () => {
    const attempts: EngramRunner[] = [
      async () => ({ code: 1, stdout: '', timedOut: false }),
      async () => ({ code: null, stdout: '', timedOut: true }),
      async () => ({
        code: 0,
        stdout: 'Update available: 3.3.2 -> 3.6.0\nusage: engram sync [--import | --status]\n',
        timedOut: false
      }),
      async () => {
        throw Object.assign(new Error('spawn engram ENOENT'), { code: 'ENOENT' })
      },
      async () => {
        throw new Error('EACCES')
      }
    ]
    for (const run of attempts) {
      const sync = createEngramCloudSync({ now: clock().now })
      expect(await sync.refresh(run, 'massorca', { force: false })).toBe(true)
    }
  })

  it('keeps reporting a failed import until the next attempt, so the throttle does not hide it', async () => {
    const run = vi.fn(async () => ({ code: 1, stdout: '', timedOut: false }))
    const sync = createEngramCloudSync({ now: clock().now })
    expect(await sync.refresh(run, 'massorca', { force: false })).toBe(true)
    expect(await sync.refresh(run, 'massorca', { force: false })).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
