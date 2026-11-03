import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHostSpace, saveHostSpace, type MobileHostSpace } from '../storage/preferences'
import { useHostSpace } from './use-host-space'

vi.mock('../storage/preferences', () => ({
  loadHostSpace: vi.fn(),
  saveHostSpace: vi.fn()
}))

type HostSpaceValue = ReturnType<typeof useHostSpace>

/** Mounts the hook and returns its latest value, read after every act. */
function mountHostSpace(): () => HostSpaceValue {
  let latest: HostSpaceValue | null = null
  function Probe() {
    latest = useHostSpace()
    return null
  }
  act(() => {
    create(createElement(Probe))
  })
  return () => {
    if (latest === null) {
      throw new Error('the hook did not render')
    }
    return latest
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useHostSpace', () => {
  beforeEach(() => {
    vi.mocked(loadHostSpace).mockReset()
    vi.mocked(saveHostSpace).mockReset()
    vi.mocked(saveHostSpace).mockResolvedValue(undefined)
  })

  it('opens on the space the user last chose', async () => {
    vi.mocked(loadHostSpace).mockResolvedValue('workspaces')
    const value = mountHostSpace()
    await act(async () => {})

    expect(value().space).toBe('workspaces')
  })

  it('opens on Bot teams until a space has been chosen', async () => {
    vi.mocked(loadHostSpace).mockResolvedValue(null)
    const value = mountHostSpace()
    await act(async () => {})

    expect(value().space).toBe('teams')
  })

  it('waits for the stored choice rather than answering Bot teams first', async () => {
    const stored = deferred<MobileHostSpace | null>()
    vi.mocked(loadHostSpace).mockReturnValue(stored.promise)
    const value = mountHostSpace()
    expect(value().space).toBeNull()

    await act(async () => {
      stored.resolve('workspaces')
    })
    expect(value().space).toBe('workspaces')
  })

  it('shows and remembers a choice at once', async () => {
    vi.mocked(loadHostSpace).mockResolvedValue(null)
    const value = mountHostSpace()
    await act(async () => {})

    act(() => {
      value().chooseSpace('workspaces')
    })
    expect(value().space).toBe('workspaces')
    expect(saveHostSpace).toHaveBeenCalledWith('workspaces')
  })

  it('keeps a choice made while the stored one is still loading', async () => {
    const stored = deferred<MobileHostSpace | null>()
    vi.mocked(loadHostSpace).mockReturnValue(stored.promise)
    const value = mountHostSpace()

    act(() => {
      value().chooseSpace('workspaces')
    })
    await act(async () => {
      stored.resolve('teams')
    })

    expect(value().space).toBe('workspaces')
  })
})
