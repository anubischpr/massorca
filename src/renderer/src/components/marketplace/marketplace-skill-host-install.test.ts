import { describe, expect, it } from 'vitest'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import {
  agentSwitchInstallRequest,
  installsOnHost,
  managedInstallForFolder,
  managedListingEnvironmentId,
  skillInstallTargetFor
} from './marketplace-skill-host-install'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

const VPS: MarketplaceVaultHostTarget = { kind: 'runtime', environmentId: 'env-vps', label: 'VPS' }
const BOX: MarketplaceVaultHostTarget = { kind: 'ssh', connectionId: 'conn-box', label: 'Box' }
const UBUNTU: MarketplaceVaultHostTarget = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }

function install(name: string, overrides: Partial<ManagedSkillInstall> = {}): ManagedSkillInstall {
  return {
    name,
    packageId: 'pkg-calendar',
    versionId: 'ver-1',
    packageDigest: 'a'.repeat(64),
    scope: 'global',
    destinationIdentity: 'global:local',
    destination: { scope: 'global' },
    installedAt: '2026-11-01T00:00:00.000Z',
    state: 'unchanged',
    ...overrides
  }
}

describe('skillInstallTargetFor', () => {
  it('opens the install dialog on the machine each picked host is', () => {
    expect(skillInstallTargetFor(null, ['codex'])).toEqual({
      environmentId: 'local',
      providers: ['codex']
    })
    expect(skillInstallTargetFor(VPS, ['codex']).environmentId).toBe('env-vps')
    expect(skillInstallTargetFor(BOX, []).environmentId).toBe('ssh:conn-box')
    expect(skillInstallTargetFor(UBUNTU, ['claude'])).toEqual({
      environmentId: 'local',
      executionTarget: { kind: 'wsl', distro: 'Ubuntu' },
      providers: ['claude']
    })
  })
})

describe('managedListingEnvironmentId', () => {
  it('asks each host for its own installs, and this computer and WSL for the local listing', () => {
    expect(managedListingEnvironmentId(VPS)).toBe('env-vps')
    expect(managedListingEnvironmentId(BOX)).toBe('ssh:conn-box')
    expect(managedListingEnvironmentId(UBUNTU)).toBeUndefined()
    expect(managedListingEnvironmentId(null)).toBeUndefined()
  })
})

describe('installsOnHost and managedInstallForFolder', () => {
  const installs = [
    install('calendar'),
    install('notes', {
      destination: { scope: 'global', executionTarget: { kind: 'wsl', distro: 'Ubuntu' } }
    }),
    install('mail', {
      scope: 'workspace',
      destination: { scope: 'workspace', worktreeId: 'wt-1' }
    })
  ]

  it('keeps this computer off the WSL distros its listing also carries', () => {
    expect(installsOnHost(null, installs).map((item) => item.name)).toEqual(['calendar', 'mail'])
    expect(installsOnHost(UBUNTU, installs).map((item) => item.name)).toEqual(['notes'])
  })

  it('finds the global install of a skill folder, and none for a folder not installed', () => {
    expect(managedInstallForFolder(installs, 'calendar')?.name).toBe('calendar')
    expect(managedInstallForFolder(installs, 'mail')).toBeUndefined()
    expect(managedInstallForFolder(installs, 'missing')).toBeUndefined()
  })
})

describe('agentSwitchInstallRequest', () => {
  it('places an installed copy for the agents the switches show, on the host it lives on', () => {
    const copy = install('calendar')
    expect(agentSwitchInstallRequest(VPS, copy, ['codex'])).toEqual({
      packageId: 'pkg-calendar',
      versionId: 'ver-1',
      environmentId: 'env-vps',
      destination: { scope: 'global' },
      providers: ['codex']
    })
    expect(agentSwitchInstallRequest(BOX, copy, ['codex'])).toEqual({
      packageId: 'pkg-calendar',
      versionId: 'ver-1',
      destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'conn-box' } },
      providers: ['codex']
    })
    expect(agentSwitchInstallRequest(UBUNTU, copy, []).destination).toEqual({
      scope: 'global',
      executionTarget: { kind: 'wsl', distro: 'Ubuntu' }
    })
  })
})
