import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runProcess } from '../../../shared/child-process/run-process'
import {
  execLocalPreflightCommandOrThrow,
  findRunnableLocalCommand,
  isCommandOnPath
} from '../../ipc/preflight-command-exec'
import { buildLocalPreflightEnv } from '../../ipc/preflight-local-env'
import { defaultMarketplaceVaultDir } from '../marketplace-vault'
import { createInstallsStore } from './git-install-store'
import { streamInstallStep } from './git-install-steps'
import type { GitInstallEnv } from './git-install-types'

const QUERY_TIMEOUT_MS = 15_000
// Why this long: winget and apt downloads on a slow link can take many minutes.
const STEP_TIMEOUT_MS = 30 * 60_000

/** The real machine: this computer only, reached through the shared runners. */
export function createLocalGitInstallEnv(
  stateFile: string = join(defaultMarketplaceVaultDir(), 'installs.json')
): GitInstallEnv {
  return {
    platform: process.platform,
    isRoot: process.getuid?.() === 0,
    readOsRelease: () => {
      try {
        return readFileSync('/etc/os-release', 'utf8')
      } catch {
        return null
      }
    },
    findCommand: findRunnableLocalCommand,
    commandOnPath: (command) => isCommandOnPath(command),
    readVersion: async (binary) =>
      (await execLocalPreflightCommandOrThrow(binary, ['--version'])).stdout,
    runQuery: async (program, args) => {
      const result = await runProcess({
        program,
        args,
        env: buildLocalPreflightEnv(),
        timeoutMs: QUERY_TIMEOUT_MS
      })
      return { code: result.timedOut ? null : result.code, stdout: result.stdout }
    },
    runStep: (step, onLine) =>
      streamInstallStep(step, {
        env: buildLocalPreflightEnv(),
        timeoutMs: STEP_TIMEOUT_MS,
        onLine
      }),
    store: createInstallsStore(stateFile),
    now: () => new Date()
  }
}
