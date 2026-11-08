import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcContext } from '../../core'

const refuse = vi.hoisted(() => ({
  fn: vi.fn(async (..._args: unknown[]): Promise<void> => {})
}))
vi.mock('../orchestration/worker/worker-bot-run', () => ({
  refuseDeniedBotCaller: (...args: unknown[]) => refuse.fn(...args)
}))

const { TERMINAL_LIFECYCLE_METHODS } = await import('./terminal-lifecycle-methods')

const create = TERMINAL_LIFECYCLE_METHODS.find((method) => method.name === 'terminal.create')!
const split = TERMINAL_LIFECYCLE_METHODS.find((method) => method.name === 'terminal.split')!

function context() {
  const runtime = {
    dedupeTerminalCreate: vi.fn(
      async (
        _client: string,
        _worktree: string,
        _mutation: unknown,
        _reconcile: boolean,
        run: (selector: string, handle?: string) => unknown
      ) => run('id:wt-1')
    ),
    createTerminal: vi.fn(async () => ({ handle: 'term_new' })),
    splitTerminal: vi.fn(async () => ({ handle: 'term_split' }))
  }
  return { runtime, ctx: { runtime } as unknown as RpcContext }
}

const createParams = () => create.params!.parse({ worktree: 'id:wt-1' })
const splitParams = () => split.params!.parse({ terminal: 'term_1', direction: 'horizontal' })

describe('a terminal opened by a caller whose bot is kept out of an app', () => {
  beforeEach(() => {
    refuse.fn.mockReset()
    refuse.fn.mockResolvedValue(undefined)
  })

  it('refuses terminal.create before any terminal is made', async () => {
    refuse.fn.mockRejectedValue(
      Object.assign(new Error('kept out'), { code: 'capability_unsupported' })
    )
    const { runtime, ctx } = context()
    await expect(create.handler(createParams() as never, ctx)).rejects.toMatchObject({
      code: 'capability_unsupported'
    })
    expect(runtime.dedupeTerminalCreate).not.toHaveBeenCalled()
    expect(runtime.createTerminal).not.toHaveBeenCalled()
  })

  it('refuses terminal.split before any terminal is made', async () => {
    refuse.fn.mockRejectedValue(
      Object.assign(new Error('kept out'), { code: 'capability_unsupported' })
    )
    const { runtime, ctx } = context()
    await expect(split.handler(splitParams() as never, ctx)).rejects.toMatchObject({
      code: 'capability_unsupported'
    })
    expect(runtime.splitTerminal).not.toHaveBeenCalled()
  })

  it('asks the check with the request’s own caller context, once per request', async () => {
    const { ctx } = context()
    await create.handler(createParams() as never, ctx)
    await split.handler(splitParams() as never, ctx)
    expect(refuse.fn).toHaveBeenCalledTimes(2)
    expect(refuse.fn.mock.calls[0]?.[1]).toBe(ctx)
  })

  it('makes the terminal exactly as before when nothing refuses', async () => {
    const { runtime, ctx } = context()
    await expect(create.handler(createParams() as never, ctx)).resolves.toEqual({
      terminal: { handle: 'term_new' }
    })
    await expect(split.handler(splitParams() as never, ctx)).resolves.toEqual({
      split: { handle: 'term_split' }
    })
    expect(runtime.createTerminal).toHaveBeenCalledTimes(1)
    expect(runtime.splitTerminal).toHaveBeenCalledTimes(1)
  })
})
