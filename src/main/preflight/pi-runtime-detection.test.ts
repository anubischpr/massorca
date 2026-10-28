import { afterEach, describe, expect, it, vi } from 'vitest'

const { detectAgentCommandsOnHostMock, getActiveMultiplexerMock } = vi.hoisted(() => ({
  detectAgentCommandsOnHostMock: vi.fn(),
  getActiveMultiplexerMock: vi.fn()
}))

vi.mock('./agent-command-detection', () => ({
  detectAgentCommandsOnHost: detectAgentCommandsOnHostMock
}))

vi.mock('../ssh/ssh-target-registry', () => ({
  getActiveMultiplexer: getActiveMultiplexerMock
}))

import { detectInstalledAgents } from './agent-detection'
import { detectInstalledPiRuntimes, detectRemotePiRuntimes } from './pi-runtime-detection'

/** Answers each probe with the commands that the host actually has, as the real probe does. */
function probeHostWith(installed: readonly string[]): void {
  detectAgentCommandsOnHostMock.mockImplementation(async (commands: readonly string[]) => {
    return new Set(commands.filter((cmd) => installed.includes(cmd)))
  })
}

afterEach(() => vi.resetAllMocks())

describe('Pi runtime detection on the execution host', () => {
  it('names both runtimes when pi and gentle-shell are installed, and keeps the agent id list as pi', async () => {
    probeHostWith(['pi', 'gentle-shell'])

    await expect(detectInstalledPiRuntimes()).resolves.toEqual(['pi', 'gentle-shell'])
    await expect(detectInstalledAgents()).resolves.toEqual(['pi'])
  })

  it('names only Gentle Shell when only its binary is installed', async () => {
    probeHostWith(['gentle-shell'])

    await expect(detectInstalledPiRuntimes()).resolves.toEqual(['gentle-shell'])
    await expect(detectInstalledAgents()).resolves.toEqual(['pi'])
  })

  it('names only stock Pi when only the pi binary is installed', async () => {
    probeHostWith(['pi'])

    await expect(detectInstalledPiRuntimes()).resolves.toEqual(['pi'])
  })

  it('names no runtime when neither binary is installed', async () => {
    probeHostWith(['claude'])

    await expect(detectInstalledPiRuntimes()).resolves.toEqual([])
    await expect(detectInstalledAgents()).resolves.toEqual(['claude'])
  })
})

describe('Pi runtime detection over an SSH execution host', () => {
  it('probes through the connection and names the Pi runtime the remote host has', async () => {
    getActiveMultiplexerMock.mockReturnValue({ isDisposed: () => false })
    probeHostWith(['gentle-shell'])

    await expect(detectRemotePiRuntimes({ connectionId: 'ssh-1' })).resolves.toEqual([
      'gentle-shell'
    ])
    expect(detectAgentCommandsOnHostMock).toHaveBeenCalledWith(['pi', 'gentle-shell'], {
      connectionId: 'ssh-1'
    })
  })

  it('names no runtime while the connection is down, without probing', async () => {
    getActiveMultiplexerMock.mockReturnValue(undefined)

    await expect(detectRemotePiRuntimes({ connectionId: 'ssh-1' })).resolves.toEqual([])
    expect(detectAgentCommandsOnHostMock).not.toHaveBeenCalled()
  })
})
