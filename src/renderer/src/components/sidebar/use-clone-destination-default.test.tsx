// @vitest-environment happy-dom

import { useState } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCloneDestinationDefault } from './use-clone-destination-default'

const { storeState, browseRuntimeMock } = vi.hoisted(() => {
  const makeStoreState = (): { settings: { hostSettingOverrides: Record<string, unknown> } } => ({
    settings: { hostSettingOverrides: {} }
  })
  return {
    storeState: makeStoreState(),
    browseRuntimeMock: vi.fn()
  }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))
vi.mock('@/runtime/runtime-server-directory-browser', () => ({
  browseRuntimeServerDirectory: browseRuntimeMock
}))

const browseDir = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', Object.assign(window, { api: { ssh: { browseDir } } }))
  browseDir.mockReset()
  browseRuntimeMock.mockReset()
  storeState.settings = { hostSettingOverrides: {} }
})

function renderDefault(options: {
  runtimeEnvironmentId?: string | null
  sshTargetId?: string | null
  initial?: string
}) {
  return renderHook(() => {
    const [cloneDestination, setCloneDestination] = useState(options.initial ?? '')
    useCloneDestinationDefault({
      step: 'clone',
      runtimeEnvironmentId: options.runtimeEnvironmentId ?? null,
      sshTargetId: options.sshTargetId ?? null,
      cloneDestination,
      setCloneDestination
    })
    return cloneDestination
  })
}

describe('useCloneDestinationDefault', () => {
  it('fills <remote home>/projects resolved on the runtime host', async () => {
    browseRuntimeMock.mockResolvedValue({ resolvedPath: '/home/christian' })
    const { result } = renderDefault({ runtimeEnvironmentId: 'pv-vps' })
    await waitFor(() => expect(result.current).toBe('/home/christian/projects'))
    expect(browseRuntimeMock).toHaveBeenCalledWith('pv-vps', '~')
  })

  it('resolves the SSH home through the relay', async () => {
    browseDir.mockResolvedValue({ resolvedPath: '/home/ana' })
    const { result } = renderDefault({ sshTargetId: 'box' })
    await waitFor(() => expect(result.current).toBe('/home/ana/projects'))
    expect(browseDir).toHaveBeenCalledWith({ targetId: 'box', dirPath: '~' })
  })

  it('prefers the host default location from Settings', async () => {
    storeState.settings = {
      hostSettingOverrides: { 'runtime:pv-vps': { defaultWorktreeLocation: '/srv/code' } }
    }
    const { result } = renderDefault({ runtimeEnvironmentId: 'pv-vps' })
    await waitFor(() => expect(result.current).toBe('/srv/code'))
    expect(browseRuntimeMock).not.toHaveBeenCalled()
  })

  it('keeps a parent the user already typed and leaves local hosts alone', async () => {
    browseRuntimeMock.mockResolvedValue({ resolvedPath: '/home/christian' })
    const typed = renderDefault({ runtimeEnvironmentId: 'pv-vps', initial: '/data/mine' })
    const local = renderDefault({})
    await Promise.resolve()
    expect(typed.result.current).toBe('/data/mine')
    expect(local.result.current).toBe('')
    expect(browseRuntimeMock).not.toHaveBeenCalled()
  })
})
