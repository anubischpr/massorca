import React, { useCallback, useEffect, useState } from 'react'
import { Trans } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import {
  resolveDismissedOnboardingFolderAgentLaunch,
  revealOnboardingFolderWithAgentLaunch
} from '@/lib/onboarding-folder-agent-launch'
import { markOnboardingProjectAdded } from '@/lib/onboarding-project-checklist'
import { i18n, translate } from '@/i18n/i18n'
import {
  initializeRuntimeRepoGit,
  runtimeRepoSupportsGitInit
} from '@/runtime/runtime-repo-git-init-client'
import type { Repo } from '../../../../shared/repo-types'
import { upsertAddedRepoWithProjectHostSetup } from './add-repo-store-upsert'
import { capturedAddRepoExecutionHostId, worktreeRefreshOptions } from './add-repo-runtime-owner'
import { adoptInitializedGitRepo, toastGitInitFailure } from './folder-project-git-init'

const NonGitFolderDialog = React.memo(function NonGitFolderDialog() {
  const activeModal = useAppStore((s) => s.activeModal)
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const addNonGitFolder = useAppStore((s) => s.addNonGitFolder)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const settings = useAppStore((s) => s.settings)
  const [isInitializing, setIsInitializing] = useState(false)
  // Why: keyed by host so an answer for one host never shows the action on another.
  const [gitInitSupport, setGitInitSupport] = useState<{
    hostKey: string
    supported: boolean
  } | null>(null)

  const isOpen = activeModal === 'confirm-non-git-folder'
  const folderPath = typeof modalData.folderPath === 'string' ? modalData.folderPath : ''
  const connectionId = typeof modalData.connectionId === 'string' ? modalData.connectionId : ''
  const runtimeEnvironmentId =
    typeof modalData.runtimeEnvironmentId === 'string' ? modalData.runtimeEnvironmentId : ''
  const displayName = typeof modalData.displayName === 'string' ? modalData.displayName.trim() : ''
  const runtimeEnvironmentName =
    runtimeEnvironmentId &&
    (runtimeEnvironments.find((environment) => environment.id === runtimeEnvironmentId)?.name ||
      runtimeEnvironmentId)
  const checkedHostDescription = connectionId
    ? translate(
        'auto.components.sidebar.NonGitFolderDialog.9a766f33ac',
        'This path was checked on the SSH host.'
      )
    : runtimeEnvironmentName
      ? translate(
          'auto.components.sidebar.NonGitFolderDialog.79fd02cf5f',
          'This path was checked on {{hostName}}.',
          { hostName: runtimeEnvironmentName }
        )
      : translate(
          'auto.components.sidebar.NonGitFolderDialog.8851b77327',
          'This path was checked locally.'
        )

  // Why: a paired host without repo.init-git.v1 must not offer `git init`.
  const executionHostId = capturedAddRepoExecutionHostId(runtimeEnvironmentId, connectionId)
  const executionHostKey = executionHostId ?? ''
  const canInitGit = gitInitSupport?.hostKey === executionHostKey && gitInitSupport.supported

  useEffect(() => {
    if (!isOpen) {
      return
    }
    let cancelled = false
    void runtimeRepoSupportsGitInit(settings, executionHostId).then((supported) => {
      if (!cancelled) {
        setGitInitSupport({ hostKey: executionHostKey, supported })
      }
    })
    return () => {
      cancelled = true
    }
  }, [executionHostId, executionHostKey, isOpen, settings])

  // Resolves with the added repo, or null when the add failed (already reported).
  const addFolderProject = useCallback(async (): Promise<Repo | null> => {
    if (connectionId && folderPath) {
      try {
        const stateBeforeAdd = useAppStore.getState()
        const result = await window.api.repos.addRemote({
          connectionId,
          remotePath: folderPath,
          kind: 'folder',
          ...(displayName ? { displayName } : {})
        })
        if ('error' in result) {
          throw new Error(result.error)
        }
        const { repo } = upsertAddedRepoWithProjectHostSetup(result.repo, {
          sshConnectionId: connectionId
        })
        const state = useAppStore.getState()
        const hadProjectBeforeAdd = stateBeforeAdd.repos.length > 0
        await markOnboardingProjectAdded('addedFolder')
        const ownerOptions = worktreeRefreshOptions(undefined, connectionId)
        await state.fetchWorktrees(repo.id, ownerOptions)
        // Why: mirror the local non-git folder flow — without this the
        // dialog closes and the UI shows no visible change, making the
        // add feel like a no-op. Activating the synthetic folder
        // worktree reveals it in the sidebar and opens the workspace.
        const folderWorktree = useAppStore
          .getState()
          .worktreesByRepo[repo.id]?.find(
            (worktree) => worktree.hostId === ownerOptions.executionHostId
          )
        if (folderWorktree) {
          const onboarding = await window.api.onboarding.get().catch(() => null)
          // Why: SSH users can hit this dialog from Add Project after
          // dismissing onboarding, bypassing the local addNonGitFolder path.
          const launch = resolveDismissedOnboardingFolderAgentLaunch({
            store: useAppStore.getState(),
            onboarding,
            hasExistingProject: hadProjectBeforeAdd,
            executionHostId: ownerOptions.executionHostId ?? connectionId
          })
          await revealOnboardingFolderWithAgentLaunch({
            worktreeId: folderWorktree.id,
            executionHostId: ownerOptions.executionHostId,
            launch
          })
        }
        return repo
      } catch (err) {
        // This code path calls addRemote directly (not through the store),
        // so the store's toast handling does not apply.
        toast.error(
          err instanceof Error
            ? err.message
            : translate(
                'auto.components.sidebar.NonGitFolderDialog.c49fb13492',
                'Failed to add folder on this host'
              )
        )
        return null
      }
    }
    if (!folderPath) {
      return null
    }
    return addNonGitFolder(folderPath, {
      runtimeEnvironmentId: runtimeEnvironmentId || null,
      ...(displayName ? { displayName } : {})
    })
  }, [addNonGitFolder, connectionId, displayName, folderPath, runtimeEnvironmentId])

  const handleContinue = useCallback(() => {
    void addFolderProject()
    closeModal()
  }, [addFolderProject, closeModal])

  const handleInitialize = useCallback(async () => {
    setIsInitializing(true)
    try {
      const repo = await addFolderProject()
      if (!repo) {
        return
      }
      const result = await initializeRuntimeRepoGit(settings, repo.id, executionHostId)
      if (!result.ok) {
        toastGitInitFailure(result.message ?? result.error)
        return
      }
      // Why: the initialized repo keeps its add-time host, so it replaces the project in place.
      await adoptInitializedGitRepo(result.repo, executionHostId)
    } catch (err) {
      toastGitInitFailure(err instanceof Error ? err.message : String(err))
    } finally {
      setIsInitializing(false)
      // Why: the add flow may open another modal; close only this dialog.
      if (useAppStore.getState().activeModal === 'confirm-non-git-folder') {
        closeModal()
      }
    }
  }, [addFolderProject, closeModal, executionHostId, settings])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Why: an in-flight add/init closes this dialog itself once it settles.
      if (!open && !isInitializing) {
        closeModal()
      }
    },
    [closeModal, isInitializing]
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm">
            {translate(
              'auto.components.sidebar.NonGitFolderDialog.15b3ae7310',
              "This folder isn't a Git repository"
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {translate(
              'auto.components.sidebar.NonGitFolderDialog.b57788d1b6',
              "You'll have the editor, terminal, and search. These features need Git and won't be available:"
            )}
          </DialogDescription>
          <ul className="list-disc pl-4.5 text-xs leading-relaxed">
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.df93b2f2d4',
                'Isolated workspaces and branches'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.7b84fb792a',
                'Child sessions in their own worktree — they would edit the same files as the parent chat'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.8761ae2bfa',
                'Changes, diffs, and commits'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.dfc6969363',
                'Pull requests and reviews'
              )}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.sidebar.NonGitFolderDialog.607a29399a',
              'Working without Git is recommended only for exploring folders and non-development work.'
            )}
          </p>
        </DialogHeader>

        {folderPath && (
          <div className="flex flex-col gap-1 rounded-md border border-border/70 bg-muted/35 px-3 py-2">
            <div className="break-all font-mono text-xs text-muted-foreground">{folderPath}</div>
            <div className="text-[11px] text-muted-foreground">{checkedHostDescription}</div>
          </div>
        )}

        {canInitGit && (
          <p className="text-[11px] text-muted-foreground">
            <Trans
              i18n={i18n}
              defaults={translate(
                'auto.components.sidebar.NonGitFolderDialog.43f90289f5',
                'Initialize Git runs <code>git init</code> here and creates an empty first commit. Your files are not committed.'
              )}
              components={{ code: <code className="font-mono" /> }}
            />
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isInitializing}
            onClick={() => handleOpenChange(false)}
          >
            {translate('auto.components.sidebar.NonGitFolderDialog.05b33a17a9', 'Cancel')}
          </Button>
          <Button variant="secondary" disabled={isInitializing} onClick={handleContinue}>
            {translate(
              'auto.components.sidebar.NonGitFolderDialog.00390f00f6',
              'Continue without Git'
            )}
          </Button>
          {canInitGit && (
            <Button disabled={isInitializing} onClick={handleInitialize}>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.482c7b0a96',
                'Initialize Git here'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default NonGitFolderDialog
