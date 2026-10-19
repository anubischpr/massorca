import { afterEach, describe, expect, it, vi } from 'vitest'
import { stopRendererOwnedPty, type PtyKillIpcDeps } from './pty/ipc/renderer-kill'
import { ptyIncarnationById, ptyOwnership } from './pty/provider/ownership-state'
import { getLocalPtyProvider, setLocalPtyProvider, sshProviders } from './pty/provider/registry'
import type { IPtyProvider } from '../providers/types'

const PTY_ID = 'pty-confirm-1'
const SSH_CONNECTION = 'ssh-confirm'
const SSH_PTY_ID = `ssh:${SSH_CONNECTION}@@pty-9`

const priorProvider = getLocalPtyProvider()
afterEach(() => {
  setLocalPtyProvider(priorProvider)
  sshProviders.delete(SSH_CONNECTION)
  for (const id of [PTY_ID, SSH_PTY_ID]) {
    ptyOwnership.delete(id)
    ptyIncarnationById.delete(id)
  }
})

function stubProvider(listProcesses: () => Promise<{ id: string }[]>) {
  const stub = { listProcesses: vi.fn(listProcesses) }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the kill route reaches the provider only through the shutdown port below and listProcesses.
  return { stub, provider: stub as unknown as IPtyProvider }
}

function createDeps(shutdown: () => Promise<boolean>) {
  const sendPtyExitToRenderer = vi.fn()
  const deps: PtyKillIpcDeps = {
    getLocalPtyProviderStartupPromise: () => undefined,
    shutdownProviderAndDetectExit: vi.fn(shutdown),
    rememberSyntheticKillExit: vi.fn(),
    sendPtyExitToRenderer
  }
  return { deps, sendPtyExitToRenderer }
}

function installLocal(listProcesses: () => Promise<{ id: string }[]>) {
  const { stub, provider } = stubProvider(listProcesses)
  setLocalPtyProvider(provider)
  ptyOwnership.set(PTY_ID, null)
  return stub
}

describe('pty:kill exit confirmation', () => {
  it('confirms when the provider exit was observed, without asking the inventory', async () => {
    const provider = installLocal(async () => [])
    const { deps, sendPtyExitToRenderer } = createDeps(async () => true)

    await expect(stopRendererOwnedPty(deps, { id: PTY_ID, confirmExit: true })).resolves.toEqual({
      exitConfirmed: true
    })
    expect(provider.listProcesses).not.toHaveBeenCalled()
    expect(sendPtyExitToRenderer).not.toHaveBeenCalled()
  })

  it('confirms an unobserved exit when the host inventory no longer lists the PTY', async () => {
    const provider = installLocal(async () => [{ id: 'another-pty' }])
    const { deps, sendPtyExitToRenderer } = createDeps(async () => false)

    await expect(stopRendererOwnedPty(deps, { id: PTY_ID, confirmExit: true })).resolves.toEqual({
      exitConfirmed: true
    })
    expect(provider.listProcesses).toHaveBeenCalledTimes(1)
    // The synthesized exit is unchanged: it stays the renderer's teardown signal.
    expect(sendPtyExitToRenderer).toHaveBeenCalledWith(expect.objectContaining({ code: -1 }))
  })

  it('does not confirm while the host inventory still lists the PTY', async () => {
    installLocal(async () => [{ id: PTY_ID }])
    const { deps, sendPtyExitToRenderer } = createDeps(async () => false)

    await expect(stopRendererOwnedPty(deps, { id: PTY_ID, confirmExit: true })).resolves.toEqual({
      exitConfirmed: false
    })
    expect(sendPtyExitToRenderer).toHaveBeenCalledWith(expect.objectContaining({ code: -1 }))
  })

  it('adds no inventory round trip unless confirmation was requested', async () => {
    const provider = installLocal(async () => [])
    const { deps } = createDeps(async () => false)

    await expect(stopRendererOwnedPty(deps, { id: PTY_ID })).resolves.toEqual({
      exitConfirmed: false
    })
    expect(provider.listProcesses).not.toHaveBeenCalled()
  })

  it('treats a failed inventory read as unconfirmed', async () => {
    installLocal(async () => {
      throw new Error('relay unreachable')
    })
    const { deps } = createDeps(async () => false)

    await expect(stopRendererOwnedPty(deps, { id: PTY_ID, confirmExit: true })).resolves.toEqual({
      exitConfirmed: false
    })
  })

  it('verifies a PTY the provider already reported gone', async () => {
    const { stub, provider } = stubProvider(async () => [])
    setLocalPtyProvider(provider)
    ptyOwnership.set(PTY_ID, null)
    const { deps } = createDeps(async () => {
      throw new Error('Session not found: pty-confirm-1')
    })

    // Already-gone alone is not proof; only the inventory is.
    await expect(stopRendererOwnedPty(deps, { id: PTY_ID })).resolves.toEqual({
      exitConfirmed: false
    })
    expect(stub.listProcesses).not.toHaveBeenCalled()
    ptyOwnership.set(PTY_ID, null)
    await expect(stopRendererOwnedPty(deps, { id: PTY_ID, confirmExit: true })).resolves.toEqual({
      exitConfirmed: true
    })
    expect(stub.listProcesses).toHaveBeenCalledTimes(1)
  })

  it('never confirms when the SSH provider is no longer registered', async () => {
    ptyOwnership.set(SSH_PTY_ID, SSH_CONNECTION)
    const { deps, sendPtyExitToRenderer } = createDeps(async () => true)

    await expect(
      stopRendererOwnedPty(deps, { id: SSH_PTY_ID, confirmExit: true })
    ).resolves.toEqual({ exitConfirmed: false })
    expect(deps.shutdownProviderAndDetectExit).not.toHaveBeenCalled()
    expect(sendPtyExitToRenderer).toHaveBeenCalledWith(expect.objectContaining({ code: -1 }))
  })

  it('confirms an SSH stop only from the relay inventory', async () => {
    const { stub, provider } = stubProvider(async () => [])
    sshProviders.set(SSH_CONNECTION, provider)
    ptyOwnership.set(SSH_PTY_ID, SSH_CONNECTION)
    const { deps } = createDeps(async () => false)

    await expect(
      stopRendererOwnedPty(deps, { id: SSH_PTY_ID, confirmExit: true })
    ).resolves.toEqual({ exitConfirmed: true })
    expect(stub.listProcesses).toHaveBeenCalledTimes(1)
  })
})
