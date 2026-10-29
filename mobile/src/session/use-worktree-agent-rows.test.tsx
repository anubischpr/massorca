import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { useWorktreeAgentRows } from './use-worktree-agent-rows'

const catalog = vi.hoisted(() => ({
  request: vi.fn<(client: unknown, params: unknown) => Promise<unknown>>(),
  interpret: vi.fn<(reply: unknown) => unknown>()
}))
vi.mock('../worktree/worktree-catalog-operations', () => ({ worktreeCatalogRead: catalog }))

type Rows = ReturnType<typeof useWorktreeAgentRows>

let latest: Rows | null = null

function Probe({ client }: { client: RpcClient | null }) {
  latest = useWorktreeAgentRows(client)
  return null
}

function fakeClient(): RpcClient {
  return {
    sendRequest: vi.fn(),
    subscribe: vi.fn(),
    updateTerminalSubscriptionViewport: vi.fn(),
    getState: vi.fn(),
    getReconnectAttempt: vi.fn(),
    getLastConnectedAt: vi.fn(),
    onStateChange: vi.fn(),
    notifyForeground: vi.fn(),
    close: vi.fn()
  }
}

function accepted(worktreeId: string) {
  return { accepted: true, value: { worktrees: [{ worktreeId, agents: [] }] } }
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('useWorktreeAgentRows', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    latest = null
    catalog.request.mockReset()
    catalog.interpret.mockReset()
  })

  function mount(client: RpcClient | null): void {
    act(() => {
      renderer = create(createElement(Probe, { client }))
    })
  }

  function worktreeIds(): string[] {
    return (latest?.worktrees ?? []).map((worktree) => worktree.worktreeId)
  }

  it('keeps the rows it knows when a later read is refused', async () => {
    catalog.interpret.mockImplementation((reply) => reply)
    catalog.request
      .mockResolvedValueOnce(accepted('wt-a'))
      .mockResolvedValueOnce({ accepted: false })
    mount(fakeClient())
    await flush()
    expect(worktreeIds()).toEqual(['wt-a'])

    act(() => latest?.refresh())
    await flush()

    expect(catalog.request).toHaveBeenCalledTimes(2)
    expect(worktreeIds()).toEqual(['wt-a'])
  })

  it('reads once more for a request made while a read is in flight', async () => {
    const replies: ((reply: unknown) => void)[] = []
    catalog.interpret.mockImplementation((reply) => reply)
    catalog.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          replies.push(resolve)
        })
    )
    mount(fakeClient())
    expect(catalog.request).toHaveBeenCalledTimes(1)

    act(() => latest?.refresh())
    expect(catalog.request).toHaveBeenCalledTimes(1)

    await act(async () => replies[0]?.(accepted('wt-a')))
    await flush()
    expect(catalog.request).toHaveBeenCalledTimes(2)

    await act(async () => replies[1]?.(accepted('wt-b')))
    await flush()
    expect(worktreeIds()).toEqual(['wt-b'])
  })
})
