import { app, BrowserWindow, dialog } from 'electron'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveCommandOnLocalPath } from '../../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../../ipc/preflight-local-env'
import { runProcess } from '../../../shared/child-process/run-process'
import { ENGRAM_CLOUD_SERVER_ENV, ENGRAM_CLOUD_TOKEN_ENV } from '../../../shared/marketplace-apps'
import { buildMarketplaceAgentEnv } from '../marketplace-agent-env'
import { createEngramOpsService, type EngramOpsService } from './engram-ops-service'

/** The vault's Engram server and sign-in; both are needed, and only these two vars are passed on. */
function readEngramCloudEnv(): Record<string, string> {
  const vaultEnv = buildMarketplaceAgentEnv()
  const server = vaultEnv[ENGRAM_CLOUD_SERVER_ENV]
  const token = vaultEnv[ENGRAM_CLOUD_TOKEN_ENV]
  return server && token
    ? { [ENGRAM_CLOUD_SERVER_ENV]: server, [ENGRAM_CLOUD_TOKEN_ENV]: token }
    : {}
}

function syncTimesPath(): string {
  return join(app.getPath('userData'), 'marketplace-engram-sync-times.json')
}

/** Project names and the time of their last sync, nothing else. */
async function readSyncTimes(): Promise<Record<string, number>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(syncTimesPath(), 'utf8'))
    const times: Record<string, number> = {}
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [name, at] of Object.entries(parsed)) {
        if (typeof at === 'number') {
          times[name] = at
        }
      }
    }
    return times
  } catch {
    return {}
  }
}

async function writeSyncTime(name: string, at: number): Promise<void> {
  const times = await readSyncTimes()
  times[name] = at
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(syncTimesPath(), JSON.stringify(times), 'utf8')
}

export function createDefaultEngramOpsService(): EngramOpsService {
  return createEngramOpsService({
    resolveProgram: () => resolveCommandOnLocalPath('engram', { env: buildLocalPreflightEnv() }),
    run: async (program, args, timeoutMs, env) => {
      // Why: a spawn env replaces the whole environment, so extra vars go on top of the usual one.
      const result = await runProcess({
        program,
        args,
        timeoutMs,
        maxOutputBytes: 64 * 1024,
        ...(env ? { env: { ...(buildLocalPreflightEnv() ?? process.env), ...env } } : {})
      })
      return { code: result.code, output: `${result.stdout}\n${result.stderr}` }
    },
    cloud: {
      cloudEnv: readEngramCloudEnv,
      loadSyncTimes: readSyncTimes,
      saveSyncTime: writeSyncTime,
      now: Date.now
    },
    pickFile: async () => {
      const options: Electron.OpenDialogOptions = {
        title: 'Choose an Engram export file',
        properties: ['openFile'],
        filters: [{ name: 'Engram export', extensions: ['json'] }]
      }
      const owner = BrowserWindow.getFocusedWindow()
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },
    fileSize: async (path) => {
      try {
        const info = await stat(path)
        return info.isFile() ? info.size : null
      } catch {
        return null
      }
    }
  })
}
