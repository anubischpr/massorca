import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createPiModelCatalogProbe, piModelCatalogFromListing } from './rpc-model-catalog-probe'
import * as launchResolution from './rpc-launch-resolution'

const TABLE = [
  'provider   model            context  max-out  thinking  images',
  'anthropic  claude-sonnet-4  200K     64K      yes       yes',
  'openai     gpt-4o-mini      128K     16K      no        yes'
].join('\n')

describe('Pi model catalog', () => {
  it('uses the session-selected Gentle Shell command instead of the host stock Pi', async () => {
    const resolve = vi
      .spyOn(launchResolution, 'resolvePiRpcCommand')
      .mockReturnValue('/opt/gentle-shell')
    const supports = vi.spyOn(launchResolution, 'piRpcVersionSupported').mockResolvedValue(true)
    const runListing = vi.fn(async () => TABLE)
    try {
      const probe = createPiModelCatalogProbe({ resolveEnvironment: async () => ({}), runListing })
      await probe(
        { variable: 'PI_CODING_AGENT_DIR', path: '/homes/gentle' },
        { piRuntime: 'gentle-shell' }
      )
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        { agentCmdOverrides: { pi: 'gentle-shell' } },
        undefined
      )
      expect(runListing).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/opt/gentle-shell',
          env: expect.objectContaining({ PI_CODING_AGENT_DIR: '/homes/gentle' })
        }),
        expect.any(Object)
      )
    } finally {
      resolve.mockRestore()
      supports.mockRestore()
    }
  })
  it('reuses the listing identity, with the levels every reasoning model keeps and no default', () => {
    expect(piModelCatalogFromListing(TABLE)).toEqual([
      {
        id: 'anthropic/claude-sonnet-4',
        label: expect.any(String),
        isDefault: false,
        efforts: ['off', 'minimal', 'low', 'medium', 'high'].map((level) => ({
          value: level,
          label: level
        }))
      },
      { id: 'openai/gpt-4o-mini', label: expect.any(String), isDefault: false, efforts: [] }
    ])
  })

  it('lists under the pinned account with the chat launch env, through the shared runner', async () => {
    const runListing = vi.fn(async () => TABLE)
    const probe = createPiModelCatalogProbe({
      resolveEnvironment: async () => ({
        PATH: '/usr/bin',
        HOME: '/home/user',
        ORCA_PANE_KEY: 'p'
      }),
      resolveCommand: () => '/opt/pi/bin/pi',
      probeVersion: async () => true,
      homePath: '/home/user',
      runListing
    })
    const success = await probe({ variable: 'PI_CODING_AGENT_DIR', path: '/homes/pi-a' })
    expect(success.models).toHaveLength(2)
    expect(runListing).toHaveBeenCalledWith(
      expect.objectContaining({
        command: '/opt/pi/bin/pi',
        args: ['--list-models'],
        env: expect.objectContaining({ PI_CODING_AGENT_DIR: '/homes/pi-a' })
      }),
      { site: 'pi-model-catalog-probe' }
    )
  })

  it('lists nothing from a Pi that runs no structured chat', async () => {
    const runListing = vi.fn()
    const probe = createPiModelCatalogProbe({
      resolveEnvironment: async () => ({ PATH: '/usr/bin' }),
      resolveCommand: () => '/opt/pi/bin/pi',
      probeVersion: async () => false,
      runListing
    })
    await expect(probe({ variable: 'PI_CODING_AGENT_DIR', path: '/homes/pi-a' })).rejects.toThrow(
      /does not run structured chats/
    )
    expect(runListing).not.toHaveBeenCalled()
  })

  it('lists through Gentle Shell when only that is installed and no runtime was named', async () => {
    const bin = await mkdtemp(join(tmpdir(), 'orca-catalog-gentle-'))
    const file = join(bin, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell')
    // Gentle Shell is probed by running it, so the stub prints what the real wrapper does.
    await writeFile(
      file,
      process.platform === 'win32'
        ? '@echo off\r\necho gentle-shell 4.3.0\r\necho pi 1.3.0\r\n'
        : "#!/bin/sh\nprintf 'gentle-shell 4.3.0\\npi 1.3.0\\n'\n"
    )
    await chmod(file, 0o755)
    const runListing = vi.fn(async () => TABLE)
    try {
      const probe = createPiModelCatalogProbe({
        resolveEnvironment: async () => ({ PATH: bin }),
        probeVersion: async () => false,
        runListing
      })
      await probe({ variable: 'PI_CODING_AGENT_DIR', path: '/homes/pi-a' })
      expect(runListing).toHaveBeenCalledWith(
        expect.objectContaining({ command: file, args: ['--list-models'] }),
        expect.any(Object)
      )
    } finally {
      await rm(bin, { recursive: true, force: true })
    }
  })

  it('keeps stock Pi first when both are installed', async () => {
    const runListing = vi.fn(async () => TABLE)
    const probe = createPiModelCatalogProbe({
      resolveEnvironment: async () => ({ PATH: '/usr/bin' }),
      resolveCommand: (command) => `/bin/${command}`,
      probeVersion: async () => true,
      runListing
    })
    await probe({ variable: 'PI_CODING_AGENT_DIR', path: '/homes/pi-a' })
    expect(runListing).toHaveBeenCalledWith(
      expect.objectContaining({ command: '/bin/pi' }),
      expect.any(Object)
    )
  })

  it('never swaps an explicitly named stock runtime for Gentle Shell', async () => {
    const probe = createPiModelCatalogProbe({
      resolveEnvironment: async () => ({ PATH: '/usr/bin' }),
      resolveCommand: (command) => `/bin/${command}`,
      probeVersion: async (launch) => launch.program === '/bin/gentle-shell',
      runListing: vi.fn()
    })
    await expect(
      probe({ variable: 'PI_CODING_AGENT_DIR', path: '/homes/pi-a' }, { piRuntime: 'pi' })
    ).rejects.toThrow(/does not run structured chats/)
  })
})
