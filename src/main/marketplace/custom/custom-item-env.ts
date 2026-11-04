import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { runProcess } from '../../../shared/child-process/run-process'
import { findRunnableLocalCommand } from '../../ipc/preflight-command-exec'
import { buildLocalPreflightEnv } from '../../ipc/preflight-local-env'
import { streamInstallStep } from '../install/git-install-steps'
import { defaultMarketplaceVaultDir } from '../marketplace-vault'
import {
  CUSTOM_CHECK_TIMEOUT_MS,
  type CheckRun,
  type CustomItemProbeEnv
} from './custom-item-probe'
import { createCustomItemStore, type CustomItemStore } from './custom-item-store'

/** Installers can run for minutes, so they get the same budget as the Git install steps. */
export const CUSTOM_INSTALL_TIMEOUT_MS = 30 * 60_000

export type CustomInstallRun = { code: number | null; timedOut: boolean }

/** Everything the custom item service touches on the machine; tests replace it wholesale. */
export type CustomItemEnv = CustomItemProbeEnv & {
  platform: NodeJS.Platform
  /** Runs an argv and streams its output lines; rejects only when it cannot be started. */
  runInstall: (argv: readonly string[], onLine: (line: string) => void) => Promise<CustomInstallRun>
  store: CustomItemStore
  now: () => number
  newId: () => string
}

/** This computer, with the same runners the Git install uses. */
export function createLocalCustomItemEnv(
  file: string = join(defaultMarketplaceVaultDir(), 'custom.json')
): CustomItemEnv {
  return {
    platform: process.platform,
    findCommand: findRunnableLocalCommand,
    runCheck: async (program, args): Promise<CheckRun> => {
      const result = await runProcess({
        program,
        args,
        env: buildLocalPreflightEnv(),
        timeoutMs: CUSTOM_CHECK_TIMEOUT_MS
      })
      return { code: result.code, timedOut: result.timedOut }
    },
    runInstall: (argv, onLine) =>
      streamInstallStep(
        { id: 'install', label: 'Install', argv, elevation: 'none', failure: 'step-failed' },
        { env: buildLocalPreflightEnv(), timeoutMs: CUSTOM_INSTALL_TIMEOUT_MS, onLine }
      ),
    store: createCustomItemStore(file),
    now: () => Date.now(),
    newId: () => randomUUID()
  }
}
