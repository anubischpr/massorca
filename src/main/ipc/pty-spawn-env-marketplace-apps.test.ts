import { describe, expect, it, vi } from 'vitest'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { createDaemonActiveProviderFixtures } from './pty-ipc-daemon-provider-fixtures'

vi.mock('electron', () => import('./pty-ipc-mock-registry').then((m) => m.electronModuleMock()))
vi.mock('fs', () => import('./pty-ipc-mock-registry').then((m) => m.fsModuleMock()))
vi.mock('node-pty', () => import('./pty-ipc-mock-registry').then((m) => m.nodePtyModuleMock()))
vi.mock('node:child_process', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).childProcessModuleMock(await importOriginal())
)
vi.mock('../opencode/hook-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.openCodeHookServiceModuleMock())
)
vi.mock('../mimo/hook-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.mimoHookServiceModuleMock())
)
vi.mock('../agent-hooks/server', () =>
  import('./pty-ipc-mock-registry').then((m) => m.agentHookServerModuleMock())
)
vi.mock('../pi/titlebar-extension-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.piTitlebarExtensionModuleMock())
)
vi.mock('../pwsh', () => import('./pty-ipc-mock-registry').then((m) => m.pwshModuleMock()))
vi.mock('../wsl', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).wslModuleMock(await importOriginal())
)
vi.mock('../telemetry/client', () =>
  import('./pty-ipc-mock-registry').then((m) => m.telemetryClientModuleMock())
)
vi.mock('../telemetry/classify-error', () =>
  import('./pty-ipc-mock-registry').then((m) => m.classifyErrorModuleMock())
)
vi.mock('../cli/linux-terminal-orca-cli-shim', () =>
  import('./pty-ipc-mock-registry').then((m) => m.linuxCliShimModuleMock())
)
vi.mock('../memory/pty-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.ptyRegistryModuleMock())
)
vi.mock('../agent-hooks/migration-unsupported-pty-state', () =>
  import('./pty-ipc-mock-registry').then((m) => m.migrationUnsupportedPtyModuleMock())
)
vi.mock('../codex/codex-pane-account-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexPaneAccountRegistryModuleMock())
)
vi.mock('../codex/codex-state-db-backfill-recovery', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexBackfillRecoveryModuleMock())
)

const marketplaceEnv = vi.hoisted((): { values: Record<string, string> } => ({ values: {} }))
vi.mock('../marketplace/marketplace-agent-env', () => ({
  buildMarketplaceAgentEnv: () => ({ ...marketplaceEnv.values })
}))

describe('registerPtyHandlers marketplace env', () => {
  const { handlers, mainWindow, spawnAndGetEnv } = setupPtyIpcSuite()
  const { daemonSpawnAndGetEnv } = createDaemonActiveProviderFixtures({ handlers, mainWindow })

  it('gives a LocalPtyProvider spawn the connected apps credentials', async () => {
    marketplaceEnv.values = { OPENMETADATA_TOKEN: 'vault-token' }
    const env = await spawnAndGetEnv({ KEEP_ME: '1' })
    expect(env.OPENMETADATA_TOKEN).toBe('vault-token')
    expect(env.KEEP_ME).toBe('1')
  })

  it('gives a daemon-backed spawn the same credentials', async () => {
    marketplaceEnv.values = { OPENMETADATA_TOKEN: 'vault-token', ENGRAM_CLOUD_SERVER: 'https://e' }
    const env = await daemonSpawnAndGetEnv({ KEEP_ME: '1' })
    expect(env.OPENMETADATA_TOKEN).toBe('vault-token')
    expect(env.ENGRAM_CLOUD_SERVER).toBe('https://e')
    expect(env.KEEP_ME).toBe('1')
  })

  it('adds nothing when no app is connected', async () => {
    marketplaceEnv.values = {}
    expect((await spawnAndGetEnv()).OPENMETADATA_TOKEN).toBeUndefined()
    expect((await daemonSpawnAndGetEnv()).OPENMETADATA_TOKEN).toBeUndefined()
  })
})
