import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { callRuntimeRpc, type getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import {
  ghAccountInferenceNeedsOrgLookup,
  ghAccountKey,
  inferGhAccount,
  type GhAccountInference
} from '../../../../shared/github/gh-account-inference'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/telemetry-events'
import { applyRepositoryGhAccountGitConfig } from '../settings/repository-github-account'

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

/** `auto` infers from the remote, `none` keeps the ambient gh login, else an account key. */
export type AddRepoGhAccountChoice = 'auto' | 'none' | (string & {})

export type RepoGhAccountInferenceResult = {
  inference: GhAccountInference | null
  remoteOwner: string | null
}

const LOOKUP_TIMEOUT_MS = 30_000

function targetFor(runtimeEnvironmentId: string | null): RuntimeTarget {
  return runtimeEnvironmentId
    ? { kind: 'environment', environmentId: runtimeEnvironmentId }
    : { kind: 'local' }
}

async function listAccounts(target: RuntimeTarget): Promise<GhAccountBinding[]> {
  const inventory =
    target.kind === 'environment'
      ? await callRuntimeRpc<GhAccountBindingInventory>(
          target,
          'github.listHostBindableAccounts',
          {},
          { timeoutMs: LOOKUP_TIMEOUT_MS }
        )
      : await window.api.gh.listHostBindableAccounts({})
  if (inventory.capability !== 'supported') {
    return []
  }
  return inventory.accounts
    .filter((account) => account.source === 'keyring')
    .map((account) => ({ host: account.host.trim().toLowerCase(), user: account.user }))
}

async function listOrgs(
  target: RuntimeTarget,
  accounts: GhAccountBinding[]
): Promise<Map<string, string[]>> {
  const record =
    target.kind === 'environment'
      ? await callRuntimeRpc<Record<string, string[]>>(
          target,
          'github.listAccountOrgs',
          { accounts },
          { timeoutMs: LOOKUP_TIMEOUT_MS }
        )
      : await window.api.gh.listAccountOrgs({ accounts })
  return new Map(Object.entries(record))
}

async function inferForRepo(
  target: RuntimeTarget,
  repo: { id: string; path: string }
): Promise<RepoGhAccountInferenceResult> {
  return target.kind === 'environment'
    ? callRuntimeRpc<RepoGhAccountInferenceResult>(
        target,
        'github.inferRepoAccount',
        { repo: repo.id },
        { timeoutMs: LOOKUP_TIMEOUT_MS }
      )
    : window.api.gh.inferRepoAccount({ repoPath: repo.path, repoId: repo.id })
}

/** GitHub account choice for the Add Project dialog, scoped to the selected host. */
type CompleteGitRepoAdd = (
  repoId: string,
  source: AddRepoExistingWorkspaceSource,
  executionHostId?: ExecutionHostId
) => Promise<void>

/** `completeGitRepoAdd` is wrapped so every git add path binds the account before the handoff. */
export function useAddRepoGhAccount(
  isOpen: boolean,
  runtimeEnvironmentId: string | null,
  completeGitRepoAdd?: CompleteGitRepoAdd
) {
  const [accounts, setAccounts] = useState<GhAccountBinding[]>([])
  const target = useMemo(() => targetFor(runtimeEnvironmentId), [runtimeEnvironmentId])
  // Why: a pick belongs to one host and dialog session; another host or a reopen falls back to auto.
  const scopeKey = `${isOpen ? 'open' : 'closed'}:${runtimeEnvironmentId ?? 'local'}`
  const [scopedChoice, setScopedChoice] = useState<{
    scope: string
    choice: AddRepoGhAccountChoice
  }>({ scope: scopeKey, choice: 'auto' })
  const choice = scopedChoice.scope === scopeKey ? scopedChoice.choice : 'auto'
  const setChoice = useCallback(
    (next: AddRepoGhAccountChoice) => setScopedChoice({ scope: scopeKey, choice: next }),
    [scopeKey]
  )
  const generationRef = useRef(0)

  useEffect(() => {
    const generation = ++generationRef.current
    if (!isOpen) {
      return
    }
    listAccounts(target)
      .then((next) => {
        if (generation === generationRef.current) {
          setAccounts(next)
        }
      })
      .catch(() => {
        // Why: older hosts lack the listing; the dialog then simply offers no picker.
        if (generation === generationRef.current) {
          setAccounts([])
        }
      })
  }, [isOpen, target])

  const explicitBinding = useCallback(
    (): GhAccountBinding | null =>
      accounts.find((account) => ghAccountKey(account) === choice) ?? null,
    [accounts, choice]
  )

  /** Account to clone with: the explicit pick, or the remote-inferred one when unambiguous. */
  const resolveForCloneUrl = useCallback(
    async (url: string): Promise<GhAccountBinding | null> => {
      if (choice === 'none' || accounts.length === 0) {
        return null
      }
      if (choice !== 'auto') {
        return explicitBinding()
      }
      const input = { accounts, remoteUrl: url }
      const direct = inferGhAccount(input)
      if (direct || !ghAccountInferenceNeedsOrgLookup(input)) {
        return direct?.binding ?? null
      }
      try {
        return (
          inferGhAccount({ ...input, orgsByAccount: await listOrgs(target, accounts) })?.binding ??
          null
        )
      } catch {
        return null
      }
    },
    [accounts, choice, explicitBinding, target]
  )

  /** Binds the newly added repo (Repo.ghAccount + repo-local git config) per the choice. */
  const applyAfterAdd = useCallback(
    async (repoId: string, executionHostId?: ExecutionHostId): Promise<void> => {
      if (choice === 'none' || accounts.length === 0) {
        return
      }
      const state = useAppStore.getState()
      const repo = state.repos.find((entry) => entry.id === repoId)
      if (!repo) {
        return
      }
      try {
        let binding = choice === 'auto' ? null : explicitBinding()
        if (choice === 'auto') {
          const result = await inferForRepo(target, repo)
          binding = result.inference?.binding ?? null
          if (!binding && result.remoteOwner) {
            toast.info(
              translate(
                'auto.components.sidebar.useAddRepoGhAccount.chooseAccount',
                'Choose which GitHub account {{project}} uses in Settings → Projects → GitHub Account.',
                { project: repo.displayName }
              )
            )
          }
        }
        if (!binding) {
          return
        }
        const saved = await state.updateRepo(
          repo.id,
          { ghAccount: binding },
          executionHostId ? { hostId: executionHostId } : undefined
        )
        if (saved === false) {
          throw new Error('Could not save the GitHub account binding.')
        }
        const result = await applyRepositoryGhAccountGitConfig(target, repo, {
          next: binding,
          previous: null,
          setIdentity: false
        })
        if (!result.ok) {
          throw new Error(result.message ?? result.error)
        }
      } catch (err) {
        toast.error(
          translate(
            'auto.components.sidebar.useAddRepoGhAccount.bindFailed',
            'Project added, but its GitHub account could not be set: {{message}}',
            { message: err instanceof Error ? err.message : String(err) }
          )
        )
      }
    },
    [accounts.length, choice, explicitBinding, target]
  )

  const completeRepoAdd = useCallback<CompleteGitRepoAdd>(
    async (repoId, source, executionHostId) => {
      await applyAfterAdd(repoId, executionHostId)
      await completeGitRepoAdd?.(repoId, source, executionHostId)
    },
    [applyAfterAdd, completeGitRepoAdd]
  )

  return { accounts, choice, setChoice, target, resolveForCloneUrl, applyAfterAdd, completeRepoAdd }
}
