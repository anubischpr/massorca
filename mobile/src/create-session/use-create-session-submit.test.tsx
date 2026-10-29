import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { CreateSessionLaunchResult } from './create-session-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'
import { useCreateSessionSubmit } from './use-create-session-submit'

const plan: CreateSessionLaunchPlan = {
  kind: 'new-worktree',
  repoId: 'web',
  agent: 'claude',
  prompt: 'fix it'
}

function mountHook(launch: (plan: CreateSessionLaunchPlan) => Promise<CreateSessionLaunchResult>) {
  const onLanded = vi.fn()
  const current: { value: ReturnType<typeof useCreateSessionSubmit> | null } = { value: null }
  function Probe(): null {
    current.value = useCreateSessionSubmit({ launch, onLanded })
    return null
  }
  let renderer: ReturnType<typeof create> | null = null
  act(() => {
    renderer = create(createElement(Probe))
  })
  return {
    onLanded,
    hook: () => {
      if (!current.value) {
        throw new Error('hook did not render')
      }
      return current.value
    },
    unmount: () => act(() => renderer?.unmount())
  }
}

describe('useCreateSessionSubmit', () => {
  it('lands on success without showing an error', async () => {
    const landing: CreateSessionLaunchResult = { ok: true, worktreeId: 'wt-1', name: 'otter' }
    const { hook, onLanded } = mountHook(() => Promise.resolve(landing))
    await act(async () => {
      await hook().submit(plan)
    })
    expect(onLanded).toHaveBeenCalledWith(landing)
    expect(hook().error).toBe('')
  })

  it('returns to the form with the message when the create fails', async () => {
    const { hook, onLanded } = mountHook(() =>
      Promise.resolve({ ok: false, message: 'SSH connection is not available' })
    )
    await act(async () => {
      await hook().submit(plan)
    })
    expect(onLanded).not.toHaveBeenCalled()
    expect(hook().phase).toEqual({ kind: 'idle' })
    expect(hook().error).toBe('SSH connection is not available')
  })

  it('shows progress while the host works and ignores a second tap', async () => {
    let finish: (result: CreateSessionLaunchResult) => void = () => {}
    const launch = vi.fn(
      () =>
        new Promise<CreateSessionLaunchResult>((resolve) => {
          finish = resolve
        })
    )
    const { hook } = mountHook(launch)
    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = hook().submit(plan)
    })
    expect(hook().phase).toEqual({ kind: 'creating', plan })
    await act(async () => {
      await hook().submit(plan)
    })
    expect(launch).toHaveBeenCalledTimes(1)
    await act(async () => {
      finish({ ok: false, message: 'nope' })
      await first
    })
    expect(hook().phase).toEqual({ kind: 'idle' })
  })

  it('clears an old error when the next attempt starts', async () => {
    const results: CreateSessionLaunchResult[] = [
      { ok: false, message: 'first failure' },
      { ok: true, worktreeId: 'wt-1', name: 'otter' }
    ]
    const { hook } = mountHook(() => Promise.resolve(results.shift()!))
    await act(async () => {
      await hook().submit(plan)
    })
    expect(hook().error).toBe('first failure')
    await act(async () => {
      await hook().submit(plan)
    })
    expect(hook().error).toBe('')
  })

  it('still lands a create that finishes after the screen is gone', async () => {
    let finish: (result: CreateSessionLaunchResult) => void = () => {}
    const { hook, onLanded, unmount } = mountHook(
      () =>
        new Promise<CreateSessionLaunchResult>((resolve) => {
          finish = resolve
        })
    )
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = hook().submit(plan)
    })
    unmount()
    const landing: CreateSessionLaunchResult = { ok: true, worktreeId: 'wt-1', name: 'otter' }
    await act(async () => {
      finish(landing)
      await pending
    })
    expect(onLanded).toHaveBeenCalledWith(landing)
  })

  it('does not touch the screen when a create fails after it is gone', async () => {
    let finish: (result: CreateSessionLaunchResult) => void = () => {}
    const { hook, onLanded, unmount } = mountHook(
      () =>
        new Promise<CreateSessionLaunchResult>((resolve) => {
          finish = resolve
        })
    )
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = hook().submit(plan)
    })
    unmount()
    await act(async () => {
      finish({ ok: false, message: 'late failure' })
      await pending
    })
    expect(onLanded).not.toHaveBeenCalled()
  })
})
