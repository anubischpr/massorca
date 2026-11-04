import { BrowserWindow, dialog } from 'electron'
import { stat } from 'node:fs/promises'
import { resolveCommandOnLocalPath } from '../../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../../ipc/preflight-local-env'
import { runProcess } from '../../../shared/child-process/run-process'
import { createEngramOpsService, type EngramOpsService } from './engram-ops-service'

export function createDefaultEngramOpsService(): EngramOpsService {
  return createEngramOpsService({
    resolveProgram: () => resolveCommandOnLocalPath('engram', { env: buildLocalPreflightEnv() }),
    run: async (program, args, timeoutMs) => {
      const result = await runProcess({ program, args, timeoutMs, maxOutputBytes: 64 * 1024 })
      return { code: result.code, output: `${result.stdout}\n${result.stderr}` }
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
