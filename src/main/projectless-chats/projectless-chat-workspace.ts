import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { normalizeProjectlessChatsDir } from '../../shared/constants'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { CreateChatNamingOverride } from '../../shared/create-chat-session-naming'
import {
  createProjectlessChatId,
  projectlessChatFolderSegments,
  type ProjectlessChatWorkspaceResult
} from '../../shared/projectless-chat-folder'
import type { TuiAgent } from '../../shared/tui-agent'
import { folderWorkspaceKey } from '../../shared/workspace-scope'
import type { Store } from '../persistence'
import {
  assertFolderWorkspacePathUsable,
  getFolderWorkspacePathStatusForPath
} from '../project-groups/folder-workspace-path-status'

export const PROJECTLESS_CHATS_GROUP_NAME = 'Chats'
const MAX_CHAT_FOLDER_ATTEMPTS = 1000

type PathStatusDeps = Parameters<typeof getFolderWorkspacePathStatusForPath>[1]

export async function createProjectlessChatWorkspace(args: {
  store: Store
  createdWithAgent: TuiAgent
  createChatNaming: CreateChatNamingOverride
  connectionId: string | null
  now: Date
  pathStatusDeps: PathStatusDeps
}): Promise<ProjectlessChatWorkspaceResult> {
  // Why: the root is a local setting; an SSH location must not silently create a local folder.
  if (args.connectionId) {
    return { ok: false, code: 'ssh_location_unsupported' }
  }
  const rootDir = resolveProjectlessChatsRoot(args.store.getSettings().projectlessChatsDir)
  const { folderPath, chatId } = await createUniqueChatFolder(rootDir, args.now)
  const group = findOrCreateProjectlessChatsGroup(args.store, rootDir)
  const status = await getFolderWorkspacePathStatusForPath(
    {
      folderPath,
      projectGroupId: group.id,
      connectionId: null,
      projectGroups: args.store.getProjectGroups(),
      repos: args.store.getRepos()
    },
    args.pathStatusDeps
  )
  assertFolderWorkspacePathUsable(status)
  // Why: the chat id is a temporary name; the first agent message renames the folder workspace.
  const workspace = args.store.createFolderWorkspace({
    projectGroupId: group.id,
    name: chatId,
    folderPath,
    connectionId: null,
    creatorProvenance: { kind: 'host' },
    createdWithAgent: args.createdWithAgent,
    pendingFirstAgentMessageRename: true,
    createChatNaming: args.createChatNaming
  })
  return {
    ok: true,
    workspaceKey: folderWorkspaceKey(workspace.id),
    workspace,
    folderPath
  }
}

function resolveProjectlessChatsRoot(configured: string): string {
  const home = homedir()
  const normalized = normalizeProjectlessChatsDir(configured, home)
  const expanded =
    normalized === '~'
      ? home
      : normalized.startsWith('~/') || normalized.startsWith(`~${path.sep}`)
        ? path.join(home, normalized.slice(2))
        : normalized
  return path.resolve(expanded)
}

async function createUniqueChatFolder(
  rootDir: string,
  now: Date
): Promise<{ folderPath: string; chatId: string }> {
  for (let attempt = 1; attempt <= MAX_CHAT_FOLDER_ATTEMPTS; attempt += 1) {
    const chatId = createProjectlessChatId()
    const [dateFolder, chatFolder] = projectlessChatFolderSegments(now, chatId)
    const dateDir = path.join(rootDir, dateFolder)
    await mkdir(dateDir, { recursive: true })
    const folderPath = path.join(dateDir, chatFolder)
    try {
      // Why: a non-recursive mkdir is the atomic claim; EEXIST means another chat owns the id.
      await mkdir(folderPath)
      return { folderPath, chatId }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
        throw error
      }
    }
  }
  throw new Error('projectless_chat_folder_exhausted')
}

function findOrCreateProjectlessChatsGroup(store: Store, rootDir: string): ProjectGroup {
  const rootKey = normalizeRuntimePathForComparison(rootDir)
  const existing = store
    .getProjectGroups()
    .find(
      (group) =>
        !group.connectionId &&
        group.parentPath !== null &&
        normalizeRuntimePathForComparison(group.parentPath) === rootKey
    )
  if (existing) {
    return existing
  }
  return store.createProjectGroup({
    name: PROJECTLESS_CHATS_GROUP_NAME,
    parentPath: rootDir,
    connectionId: null,
    createdFrom: 'manual'
  })
}
