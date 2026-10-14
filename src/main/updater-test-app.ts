import type { Mock } from 'vitest'

/** Electron app contract shared by the updater's packaged-build test fixtures. */
export type UpdaterAppMock = {
  isPackaged: boolean
  getVersion: Mock<() => string>
  getAppPath: Mock<() => string>
  on: Mock<(event: string, handler: (...args: unknown[]) => void) => UpdaterAppMock>
  prependListener: Mock<(event: string, handler: (...args: unknown[]) => void) => UpdaterAppMock>
  emit: (event: string, ...args: unknown[]) => void
  quit: Mock<(...args: unknown[]) => unknown>
}
