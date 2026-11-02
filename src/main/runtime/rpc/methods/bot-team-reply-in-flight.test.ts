import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearBotTeamReplying,
  listBotTeamReplying,
  markBotTeamReplying,
  rememberBotTeamPost
} from './bot-team-reply-in-flight'

describe('bot team replies in flight', () => {
  afterEach(() => {
    vi.useRealTimers()
    clearBotTeamReplying('t1', 'iris')
    clearBotTeamReplying('t1', 'max')
  })

  it('lists the bots replying in a team with when they started, and forgets them when cleared', () => {
    markBotTeamReplying('t1', 'iris', 100)
    markBotTeamReplying('t1', 'max', 200)
    expect(listBotTeamReplying('t1')).toEqual([
      { botId: 'iris', since: 100 },
      { botId: 'max', since: 200 }
    ])
    expect(listBotTeamReplying('t2')).toEqual([])
    clearBotTeamReplying('t1', 'iris')
    expect(listBotTeamReplying('t1')).toEqual([{ botId: 'max', since: 200 }])
  })

  it('runs a post once per team and client request id, and returns the stored result after', async () => {
    const run = vi.fn(async () => ({ n: 1 }))
    const first = await rememberBotTeamPost('t1', 'req-1', run)
    const again = await rememberBotTeamPost('t1', 'req-1', run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(again).toBe(first)
    await rememberBotTeamPost('t2', 'req-1', run)
    await rememberBotTeamPost('t1', 'req-2', run)
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('shares one run with a repeat that arrives while the first is still being decided', async () => {
    let finish: (value: { n: number }) => void = () => {}
    const run = vi.fn(() => new Promise<{ n: number }>((resolve) => (finish = resolve)))
    const first = rememberBotTeamPost('t1', 'req-slow', run)
    const second = rememberBotTeamPost('t1', 'req-slow', run)
    finish({ n: 7 })
    expect(await first).toBe(await second)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('never remembers a post without an id, nor a failed one', async () => {
    const run = vi.fn(async () => ({ n: 1 }))
    await rememberBotTeamPost('t1', undefined, run)
    await rememberBotTeamPost('t1', undefined, run)
    expect(run).toHaveBeenCalledTimes(2)
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(rememberBotTeamPost('t1', 'req-bad', failing)).rejects.toThrow('boom')
    await expect(rememberBotTeamPost('t1', 'req-bad', failing)).rejects.toThrow('boom')
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('forgets a result after ten minutes', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => ({ n: 1 }))
    await rememberBotTeamPost('t1', 'req-old', run)
    vi.advanceTimersByTime(10 * 60_000 + 1)
    await rememberBotTeamPost('t1', 'req-old', run)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
