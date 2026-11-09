// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  MarketplaceHostProgramResult,
  MarketplaceHostProgramStatus
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import type { MarketplaceHostProgram } from './use-marketplace-host-program'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  readHostProgramStatus: vi.fn(),
  runHostProgramAction: vi.fn()
}))
vi.mock('./marketplace-host-program-client', () => client)

const { useMarketplaceHostProgram } = await import('./use-marketplace-host-program')

const MISSING: MarketplaceHostProgramStatus = {
  ok: true,
  installed: false,
  canInstall: true,
  canUninstall: false
}
const INSTALLED: MarketplaceHostProgramStatus = {
  ok: true,
  installed: true,
  canInstall: false,
  canUninstall: true
}

let root: Root | null = null
let latest: MarketplaceHostProgram | null = null
const changed = vi.fn()

function Probe({ hostKey }: { hostKey: string }): null {
  latest = useMarketplaceHostProgram('git', hostKey, changed)
  return null
}

async function mount(hostKey: string): Promise<void> {
  const container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root?.render(<Probe hostKey={hostKey} />))
}

beforeEach(() => {
  client.readHostProgramStatus.mockReset().mockResolvedValue(MISSING)
  client.runHostProgramAction.mockReset()
  changed.mockReset()
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  latest = null
})

describe('useMarketplaceHostProgram', () => {
  it('asks the picked host for its state', async () => {
    await mount('ssh:box')
    expect(client.readHostProgramStatus).toHaveBeenCalledWith('git', 'ssh:box')
    expect(latest?.status).toEqual(MISSING)
  })

  it('installs, reads the host again, and tells the page it changed', async () => {
    client.runHostProgramAction.mockResolvedValue({
      ok: true
    } satisfies MarketplaceHostProgramResult)
    await mount('wsl:Ubuntu')
    client.readHostProgramStatus.mockResolvedValue(INSTALLED)
    await act(async () => latest?.run('install'))
    expect(client.runHostProgramAction).toHaveBeenCalledWith('install', 'git', 'wsl:Ubuntu')
    expect(latest?.status).toEqual(INSTALLED)
    expect(latest?.phase).toEqual({ kind: 'idle' })
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('keeps what a reinstall or uninstall removed as a notice until the next run', async () => {
    client.runHostProgramAction.mockResolvedValue({
      ok: true,
      message: 'Removed /home/u/.local/bin/codex.'
    })
    await mount('local')
    await act(async () => latest?.run('reinstall'))
    expect(client.runHostProgramAction).toHaveBeenCalledWith('reinstall', 'git', 'local')
    expect(latest?.notice).toBe('Removed /home/u/.local/bin/codex.')
    client.runHostProgramAction.mockResolvedValue({ ok: true })
    await act(async () => latest?.run('uninstall'))
    expect(latest?.notice).toBeNull()
  })

  it('keeps the failure on the page and still re-reads the host', async () => {
    const failure = { ok: false, reason: 'needs-admin', command: 'sudo x' } as const
    client.runHostProgramAction.mockResolvedValue(failure)
    await mount('local')
    await act(async () => latest?.run('install'))
    expect(latest?.phase).toEqual({ kind: 'failed', action: 'install', failure })
    expect(client.readHostProgramStatus).toHaveBeenCalledTimes(2)
    expect(changed).not.toHaveBeenCalled()
    await act(async () => latest?.dismiss())
    expect(latest?.phase).toEqual({ kind: 'idle' })
  })

  it('shows running while the host works', async () => {
    let finish: (value: MarketplaceHostProgramResult) => void = () => {}
    client.runHostProgramAction.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await mount('local')
    await act(async () => void latest?.run('uninstall'))
    expect(latest?.phase).toEqual({ kind: 'running', action: 'uninstall' })
    await act(async () => finish({ ok: true }))
    expect(latest?.phase).toEqual({ kind: 'idle' })
  })

  it('starts from checking when another host is picked', async () => {
    await mount('local')
    client.readHostProgramStatus.mockReturnValue(new Promise(() => {}))
    await act(async () => root?.render(<Probe hostKey="runtime:env" />))
    expect(latest?.status).toBeNull()
    expect(latest?.hostKey).toBe('runtime:env')
  })
})
