import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRuntimeFileListForWorktree } from '@/components/quick-open-file-list'
import { rankQuickOpenFilesWithHistory } from '@/components/quick-open-history-ranking'
import { useQuickOpenHistory } from '@/lib/quick-open-file-history'
import { findTerminalTabWorktreeId } from './native-chat-file-link'
import { useKnownWorktreeById } from '@/store/selectors'
import type { MarketplaceAppMention } from '../../../../shared/marketplace-app-mentions'
import type { ExecutionHostId } from '../../../../shared/execution-host'

const MENTION_FILE_LIMIT = 20
const NO_FILES: readonly string[] = []

export type NativeChatMentionFiles = {
  /** Workspace-relative paths, best match first. */
  files: readonly string[]
  loading: boolean
  failed: boolean
  /** Projects the query matches; their paths sit between the files and the apps in `files`. */
  projects?: readonly NativeChatMentionProject[]
  /** Installed apps the query matches; their names close `files`, so the keys walk one list. */
  apps?: readonly MarketplaceAppMention[]
}

/** A project @ can name: its folder is what the message sends. */
export type NativeChatMentionProject = { name: string; path: string }

/** `query` is null while no `@` token is open. */
export function useNativeChatMentionFiles(args: {
  query: string | null
  terminalTabId: string
  structuredWorktreeId?: string
  /** The host the caller picked, and the worktree's folder for when the catalog lacks its row. */
  executionHostId?: ExecutionHostId
  rootPath?: string | null
  /** False with no folder to list, such as a projectless chat: the menu offers no files. */
  listFiles?: boolean
}): NativeChatMentionFiles {
  const { terminalTabId, structuredWorktreeId, executionHostId, rootPath } = args
  const query = args.listFiles === false ? null : args.query
  const enabled = query !== null
  // Closed is the common state, so the tab scan only runs while a token is open.
  const worktreeId = useAppStore((state) =>
    enabled
      ? (structuredWorktreeId ?? findTerminalTabWorktreeId(state.tabsByWorktree, terminalTabId))
      : null
  )
  const worktreePath = useKnownWorktreeById(worktreeId)?.path ?? rootPath ?? null
  const history = useQuickOpenHistory(worktreeId, worktreePath)
  // Memoized: the listing re-resolves its owner whenever this object changes.
  const host = useMemo(
    () => (executionHostId ? { executionHostId, rootPath: rootPath ?? null } : undefined),
    [executionHostId, rootPath]
  )
  const list = useRuntimeFileListForWorktree({
    enabled,
    worktreeId,
    query: query ?? '',
    recentPaths: history,
    host
  })
  const failed = list.loadError !== null

  return useMemo(
    () => ({
      files:
        query === null
          ? NO_FILES
          : rankQuickOpenFilesWithHistory(query, list.files, history)
              .slice(0, MENTION_FILE_LIMIT)
              .map((item) => item.path),
      loading: list.loading,
      failed
    }),
    [failed, history, list.files, list.loading, query]
  )
}
