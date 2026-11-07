import { describe, expect, it } from 'vitest'
import { buildSidebarHostOptions, type SidebarHostOption } from '../sidebar/sidebar-host-options'
import { marketplaceHostKey, marketplaceHostTargetsFrom } from './use-marketplace-host-targets'

function host(
  overrides: Partial<SidebarHostOption> & Pick<SidebarHostOption, 'id'>
): SidebarHostOption {
  return {
    label: overrides.id,
    detail: '',
    kind: 'runtime',
    health: 'available',
    presence: 'project',
    ...overrides
  }
}

describe('Marketplace host targets', () => {
  it('lists a paired server Workspaces uses even when it is not the active one', () => {
    const hosts = buildSidebarHostOptions({
      repos: [{ connectionId: null, executionHostId: 'runtime:pv-vps' }],
      sshTargetLabels: new Map(),
      settings: { activeRuntimeEnvironmentId: null },
      runtimeEnvironments: [{ id: 'pv-vps', name: 'srv2056164', source: undefined }]
    })
    const targets = marketplaceHostTargetsFrom(hosts)
    expect(targets).toEqual([{ kind: 'runtime', environmentId: 'pv-vps', label: 'srv2056164' }])
    expect(targets.map(marketplaceHostKey)).toEqual(['runtime:pv-vps'])
  })

  it('keeps connected SSH hosts and leaves out this computer and unreachable hosts', () => {
    const targets = marketplaceHostTargetsFrom([
      host({ id: 'local', kind: 'local', health: 'local', presence: 'local' }),
      host({ id: 'runtime:vps', label: 'VPS' }),
      host({ id: 'runtime:old', label: 'Old', health: 'blocked' }),
      host({ id: 'runtime:gone', label: 'Gone', health: 'disconnected' }),
      host({ id: 'ssh:box', label: 'Box', kind: 'ssh' }),
      host({ id: 'ssh:down', label: 'Down', kind: 'ssh', health: 'error' })
    ])
    expect(targets).toEqual([
      { kind: 'runtime', environmentId: 'vps', label: 'VPS' },
      { kind: 'runtime', environmentId: 'old', label: 'Old' },
      { kind: 'ssh', connectionId: 'box', label: 'Box' }
    ])
  })

  it('keys a WSL distro by its name, so a pick keeps its own host', () => {
    expect(marketplaceHostKey({ kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' })).toBe(
      'wsl:Ubuntu'
    )
  })
})
