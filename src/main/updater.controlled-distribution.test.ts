import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUpdaterModule, warmUpdaterModule } from './updater-test-module-loader'

const {
  appMock,
  autoUpdaterMock,
  powerMonitorOnMock,
  fetchNudgeMock,
  moduleFactories,
  resetUpdaterMocks
} = await vi.hoisted(async () => (await import('./updater-test-harness')).createUpdaterMocks())

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('@electron-toolkit/utils', () => moduleFactories.electronToolkitUtils())
vi.mock('./ipc/pty', () => moduleFactories.ipcPty())
vi.mock('./linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./updater-nudge', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('./local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())

const policy = vi.hoisted(() => ({ allowed: false }))
vi.mock('./updater/distribution-policy', () => ({
  readDistributionUpdatePolicy: () => policy.allowed,
  MANUAL_UPDATE_MESSAGE: 'Controlled manual updates required.'
}))

warmUpdaterModule()

describe('controlled distribution updater entry points', () => {
  beforeEach(() => {
    resetUpdaterMocks()
    policy.allowed = false
    vi.useFakeTimers()
  })

  it('never initializes feeds, listeners, campaigns or automatic timers', async () => {
    const updater = await loadUpdaterModule()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: updater setup uses only this mocked webContents.send; no native window is invoked.
    updater.setupAutoUpdater({ webContents: { send: vi.fn() } } as never)
    updater.checkForUpdates()
    appMock.emit('browser-window-focus')
    await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000)
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(autoUpdaterMock.on).not.toHaveBeenCalled()
    expect(powerMonitorOnMock).not.toHaveBeenCalled()
    expect(fetchNudgeMock).not.toHaveBeenCalled()
  })

  it('blocks menu, local, exact-tag, download and install without quitting', async () => {
    const updater = await loadUpdaterModule()
    updater.checkForUpdatesFromMenu()
    updater.checkForUpdatesFromMenu({ localBuild: true })
    updater.checkForUpdatesFromMenu({ channel: 'stable', targetTag: 'v9.0.0' })
    autoUpdaterMock.emit('update-downloaded', { version: '9.0.0' })
    updater.downloadUpdate()
    updater.quitAndInstall()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await updater.listAvailableReleaseBuilds('stable')).toEqual([])
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', retryable: false })
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled()
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()
    expect(appMock.quit).not.toHaveBeenCalled()
  })

  it('rejects remote check, download and install with the existing contract', async () => {
    const updater = await loadUpdaterModule()
    expect(updater.getRemoteServerUpdateSupport()).toMatchObject({
      automatic: false,
      reason: 'manual-service-update-required'
    })
    expect(() => updater.checkForRemoteServerUpdate('test')).toThrow(
      'remote_update_manual_required'
    )
    expect(() => updater.downloadRemoteServerUpdate('test')).toThrow(
      'remote_update_manual_required'
    )
    expect(() => updater.installRemoteServerUpdate('test')).toThrow('remote_update_manual_required')
  })

  it('preserves official startup and menu checks when unmarked', async () => {
    policy.allowed = true
    const updater = await loadUpdaterModule()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: updater setup uses only this mocked webContents.send; no native window is invoked.
    updater.setupAutoUpdater({ webContents: { send: vi.fn() } } as never)
    await vi.waitFor(() => expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1))
    expect(autoUpdaterMock.setFeedURL).toHaveBeenCalled()
  })

  it('refuses direct feed/native install and cached package recovery paths', async () => {
    const { UpdaterSetup } = await import('./updater/updater-setup')
    class ProbeUpdater extends UpdaterSetup {
      pinFeed() {
        return this.pinDefaultReleaseFeed()
      }
      nativeUpdater() {
        return this.getAutoUpdater()
      }
      performInstall() {
        return this.performQuitAndInstall()
      }
    }
    const probe = new ProbeUpdater()
    expect(await probe.pinFeed()).toBe('not-available')
    expect(() => probe.nativeUpdater()).toThrow('Controlled manual updates required.')
    await probe.performInstall()
    await expect(probe.getLinuxPackageInstallInstructions()).rejects.toThrow(
      'Controlled manual updates required.'
    )
    await expect(probe.showLinuxPackage()).rejects.toThrow('Controlled manual updates required.')
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()
    expect(appMock.quit).not.toHaveBeenCalled()
  })
})
