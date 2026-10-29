import { useCallback, useRef, useState } from 'react'
import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'
import { initFolderRepoGit } from './folder-repo-git-init'

export type FolderRepoNoGitTarget = { repoId: string; repoName: string }

type SheetState = { target: FolderRepoNoGitTarget | null; visible: boolean }

type Args = {
  client: UnvalidatedRpcRequestPort | null
  connected: boolean
  /** Re-reads the repo list so the folder marker drops once the repo is a Git project. */
  refreshRepos: () => void
  /** Shows a failed init in the list's existing action banner. */
  onFailure: (message: string) => void
}

/** The "No Git" sheet's target and visibility, plus the Initialize Git action. */
export function useFolderRepoGitInit({ client, connected, refreshRepos, onFailure }: Args) {
  // Why: one state object, so an init that finishes after the user reopened another repo's sheet
  // closes only the sheet it started from.
  const [sheet, setSheet] = useState<SheetState>({ target: null, visible: false })
  const [initializing, setInitializing] = useState(false)
  const inFlightRef = useRef(false)

  const open = useCallback((target: FolderRepoNoGitTarget) => {
    setSheet({ target, visible: true })
  }, [])

  const close = useCallback(() => {
    setSheet((current) => ({ ...current, visible: false }))
  }, [])

  const initialize = useCallback(async () => {
    const repoId = sheet.target?.repoId
    if (!client || !connected || repoId === undefined || inFlightRef.current) {
      return
    }
    inFlightRef.current = true
    setInitializing(true)
    const outcome = await initFolderRepoGit(client, repoId)
    inFlightRef.current = false
    setInitializing(false)
    setSheet((current) =>
      current.target?.repoId === repoId ? { ...current, visible: false } : current
    )
    if (outcome.ok) {
      refreshRepos()
    } else {
      onFailure(outcome.message)
    }
  }, [client, connected, sheet.target, refreshRepos, onFailure])

  return {
    target: sheet.target,
    visible: sheet.visible,
    initializing,
    open,
    close,
    initialize
  }
}
