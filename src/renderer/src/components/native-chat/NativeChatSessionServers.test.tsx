// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatSessionServers } from './NativeChatSessionServers'

const { state, openUrl, copy } = vi.hoisted(() => ({
  openUrl: vi.fn(async () => {}),
  copy: vi.fn(async () => {}),
  state: {
    workspacePortScansByKey: {
      'environment:remote:all': {
        platform: 'linux',
        scannedAt: 100,
        ports: [
          {
            id: 'port',
            kind: 'workspace',
            port: 3000,
            bindHost: '127.0.0.1',
            connectHost: 'localhost',
            protocol: 'http',
            owner: {
              worktreeId: 'selected',
              repoId: 'repo',
              path: '/repo',
              displayName: 'Selected',
              confidence: 'cwd'
            }
          }
        ]
      }
    },
    runtimeEnvironments: [
      { id: 'remote', sshAccess: { sshTargetId: 'ssh', sshTargetGeneration: 2 } }
    ],
    sshTargetGenerations: new Map([['ssh', 2]]),
    sshConnectionStates: new Map([['ssh', { status: 'connected' }]]),
    portForwardsByConnection: {
      ssh: [
        {
          id: 'forward',
          connectionId: 'ssh',
          remoteHost: '127.0.0.1',
          remotePort: 3000,
          localPort: 43000
        }
      ]
    }
  }
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state)
}))
vi.mock('@/components/right-sidebar/ssh-port-forward-dialog', () => ({
  SshPortForwardDialog: ({
    state: dialog,
    activeConnectionId
  }: {
    state: {
      mode: string
      defaults?: { remotePort?: number; remoteHost?: string; targetId?: string }
    }
    activeConnectionId: string | null
  }) =>
    dialog.mode === 'closed' ? null : (
      <div role="dialog">
        {activeConnectionId} · {dialog.defaults?.targetId} · {dialog.defaults?.remoteHost}:
        {dialog.defaults?.remotePort}
      </div>
    )
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('chat server routes', () => {
  it('copies the existing client forward rather than the remote localhost address', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy }
    })
    render(
      <NativeChatSessionServers
        target={{ kind: 'environment', environmentId: 'remote' }}
        worktreeId="selected"
        expanded
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('http://127.0.0.1:43000')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }))
    expect(copy).toHaveBeenCalledWith('http://127.0.0.1:43000')
  })

  it('offers no PC action from an unrelated or replaced SSH registration', () => {
    state.sshTargetGenerations.set('ssh', 3)
    try {
      render(
        <NativeChatSessionServers
          target={{ kind: 'environment', environmentId: 'remote' }}
          worktreeId="selected"
          expanded
          onExpand={() => {}}
        />
      )
      expect(screen.queryByRole('button', { name: 'Open on PC' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Copy URL' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Forward to PC' })).toBeNull()
      expect(openUrl).not.toHaveBeenCalled()
    } finally {
      state.sshTargetGenerations.set('ssh', 2)
    }
  })
})

it('opens the existing forward dialog with this server and linked SSH target', () => {
  const forwards = state.portForwardsByConnection.ssh
  state.portForwardsByConnection.ssh = []
  try {
    render(
      <NativeChatSessionServers
        target={{ kind: 'environment', environmentId: 'remote' }}
        worktreeId="selected"
        expanded
        onExpand={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Forward to PC' }))
    expect(screen.getByRole('dialog').textContent).toBe('ssh · ssh · 127.0.0.1:3000')
    expect(screen.queryByRole('button', { name: 'Open on PC' })).toBeNull()
  } finally {
    state.portForwardsByConnection.ssh = forwards
  }
})
