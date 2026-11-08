import type { CommandHandler } from '../dispatch'
import {
  getOptionalStringFlag,
  getRequiredStringFlag,
  getRequiredStringFlagAllowingEmpty
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { FolderWorkspacePathStatus } from '../../shared/folder-workspace-path-status'

type FolderWorkspaceUpdates = {
  name?: string
  folderPath?: string
  comment?: string
  isArchived?: boolean
  isPinned?: boolean
  isUnread?: boolean
  workspaceStatus?: string
}

function formatRow(row: FolderWorkspace): string {
  return `${row.id}  ${row.name}  ${row.folderPath}`
}

function formatRows(rows: FolderWorkspace[]): string {
  if (rows.length === 0) {
    return 'No folder workspaces.'
  }
  return rows.map(formatRow).join('\n')
}

function getOptionalBooleanFlag(
  flags: Map<string, string | boolean>,
  name: string
): boolean | undefined {
  const value = getOptionalStringFlag(flags, name)
  if (value === undefined) {
    return undefined
  }
  if (value !== 'true' && value !== 'false') {
    throw new RuntimeClientError('invalid_argument', `--${name} must be true or false.`)
  }
  return value === 'true'
}

function readUpdates(flags: Map<string, string | boolean>): FolderWorkspaceUpdates {
  const name = getOptionalStringFlag(flags, 'name')
  const folderPath = getOptionalStringFlag(flags, 'path')
  const workspaceStatus = getOptionalStringFlag(flags, 'workspace-status')
  const isArchived = getOptionalBooleanFlag(flags, 'archived')
  const isPinned = getOptionalBooleanFlag(flags, 'pinned')
  const isUnread = getOptionalBooleanFlag(flags, 'unread')
  const updates: FolderWorkspaceUpdates = {
    ...(name === undefined ? {} : { name }),
    ...(folderPath === undefined ? {} : { folderPath }),
    ...(flags.has('comment')
      ? { comment: getRequiredStringFlagAllowingEmpty(flags, 'comment') }
      : {}),
    ...(isArchived === undefined ? {} : { isArchived }),
    ...(isPinned === undefined ? {} : { isPinned }),
    ...(isUnread === undefined ? {} : { isUnread }),
    ...(workspaceStatus === undefined ? {} : { workspaceStatus })
  }
  if (Object.keys(updates).length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Nothing to update. Pass --name, --path, --comment, --archived, --pinned, --unread or --workspace-status.'
    )
  }
  return updates
}

function readPathScope(flags: Map<string, string | boolean>): Record<string, string> {
  const workspace = getOptionalStringFlag(flags, 'workspace')
  const group = getOptionalStringFlag(flags, 'group')
  const path = getOptionalStringFlag(flags, 'path')
  const connection = getOptionalStringFlag(flags, 'connection')
  if ([workspace, group, path].filter((scope) => scope !== undefined).length !== 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass exactly one of --workspace, --group or --path.'
    )
  }
  if (connection !== undefined && path === undefined) {
    throw new RuntimeClientError('invalid_argument', '--connection only goes with --path.')
  }
  if (workspace !== undefined) {
    return { scope: 'folder-workspace', folderWorkspaceId: workspace }
  }
  if (group !== undefined) {
    return { scope: 'project-group', projectGroupId: group }
  }
  return {
    scope: 'path',
    path: path ?? '',
    ...(connection === undefined ? {} : { connectionId: connection })
  }
}

export const FOLDER_WORKSPACE_HANDLERS: Record<string, CommandHandler> = {
  'folder-workspace list': async (ctx) => {
    const result = await ctx.client.call<{ folderWorkspaces: FolderWorkspace[] }>(
      'folderWorkspace.list'
    )
    printResult(result, ctx.json, (value) => formatRows(value.folderWorkspaces))
  },
  'folder-workspace create': async (ctx) => {
    const name = getOptionalStringFlag(ctx.flags, 'name')
    const folderPath = getOptionalStringFlag(ctx.flags, 'path')
    const connectionId = getOptionalStringFlag(ctx.flags, 'connection')
    const result = await ctx.client.call<{ folderWorkspace: FolderWorkspace }>(
      'folderWorkspace.create',
      {
        projectGroupId: getRequiredStringFlag(ctx.flags, 'group'),
        ...(name === undefined ? {} : { name }),
        ...(folderPath === undefined ? {} : { folderPath }),
        ...(connectionId === undefined ? {} : { connectionId })
      }
    )
    printResult(result, ctx.json, (value) => `Created ${formatRow(value.folderWorkspace)}`)
  },
  'folder-workspace update': async (ctx) => {
    const folderWorkspaceId = getRequiredStringFlag(ctx.flags, 'workspace')
    const result = await ctx.client.call<{ folderWorkspace: FolderWorkspace }>(
      'folderWorkspace.update',
      { folderWorkspaceId, updates: readUpdates(ctx.flags) }
    )
    printResult(result, ctx.json, (value) => `Updated ${formatRow(value.folderWorkspace)}`)
  },
  'folder-workspace rm': async (ctx) => {
    const folderWorkspaceId = getRequiredStringFlag(ctx.flags, 'workspace')
    const result = await ctx.client.call<{ deleted: boolean }>('folderWorkspace.delete', {
      folderWorkspaceId
    })
    if (!result.result.deleted) {
      throw new RuntimeClientError(
        'not_found',
        `No folder workspace ${folderWorkspaceId} was deleted; check \`orca folder-workspace list\`.`
      )
    }
    printResult(result, ctx.json, () => `Deleted ${folderWorkspaceId}.`)
  },
  'folder-workspace path-status': async (ctx) => {
    const result = await ctx.client.call<{ status: FolderWorkspacePathStatus }>(
      'folderWorkspace.getPathStatus',
      readPathScope(ctx.flags)
    )
    printResult(
      result,
      ctx.json,
      ({ status }) => `${status.path}  ${status.exists ? 'exists' : (status.reason ?? 'missing')}`
    )
  }
}
