import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'

function formatRows(rows: FolderWorkspace[]): string {
  if (rows.length === 0) {
    return 'No folder workspaces.'
  }
  return rows.map((row) => `${row.id}  ${row.name}  ${row.folderPath}`).join('\n')
}

export const FOLDER_WORKSPACE_HANDLERS: Record<string, CommandHandler> = {
  'folder-workspace list': async (ctx) => {
    const result = await ctx.client.call<{ folderWorkspaces: FolderWorkspace[] }>(
      'folderWorkspace.list'
    )
    printResult(result, ctx.json, (value) => formatRows(value.folderWorkspaces))
  }
}
