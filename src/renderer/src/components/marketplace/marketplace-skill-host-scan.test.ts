// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'

const mocks = vi.hoisted(() => ({
  discoverForRuntime: vi.fn(),
  discover: vi.fn()
}))

vi.mock('@/runtime/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: (...args: unknown[]) => mocks.discoverForRuntime(...args)
}))

const VPS: MarketplaceVaultHostTarget = { kind: 'runtime', environmentId: 'env-vps', label: 'VPS' }
const BOX: MarketplaceVaultHostTarget = { kind: 'ssh', connectionId: 'conn-box', label: 'Box' }
const UBUNTU: MarketplaceVaultHostTarget = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }
const FOCUSED = { kind: 'environment' as const, environmentId: 'env-focused' }

beforeEach(() => {
  mocks.discoverForRuntime.mockReset().mockResolvedValue({ skills: [] })
  mocks.discover.mockReset().mockResolvedValue({ skills: [] })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { skills: { discover: mocks.discover } }
  })
})

describe('discoverSkillsForPickedHost', () => {
  it('reads a picked runtime host through its own environment, not the focused one', async () => {
    await discoverSkillsForPickedHost(VPS, FOCUSED)
    expect(mocks.discoverForRuntime).toHaveBeenCalledWith({
      kind: 'environment',
      environmentId: 'env-vps'
    })
    expect(mocks.discover).not.toHaveBeenCalled()
  })

  it('reads a picked WSL distro through the WSL discovery target', async () => {
    await discoverSkillsForPickedHost(UBUNTU, FOCUSED)
    expect(mocks.discover).toHaveBeenCalledWith({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    expect(mocks.discoverForRuntime).not.toHaveBeenCalled()
  })

  it('has no skill read for a picked SSH host, and reads nothing for it', async () => {
    expect(await discoverSkillsForPickedHost(BOX, FOCUSED)).toBeNull()
    expect(mocks.discoverForRuntime).not.toHaveBeenCalled()
    expect(mocks.discover).not.toHaveBeenCalled()
  })

  it('keeps this computer on the focused runtime when no host is picked', async () => {
    await discoverSkillsForPickedHost(null, FOCUSED)
    expect(mocks.discoverForRuntime).toHaveBeenCalledWith(FOCUSED)
  })

  it('reads nothing for this computer when there is no focused runtime', async () => {
    expect(await discoverSkillsForPickedHost(null, null)).toBeNull()
    expect(mocks.discoverForRuntime).not.toHaveBeenCalled()
  })
})
