import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host-registry'
import { pickerExecutionHosts } from '../../../../shared/managed-orcad-execution-host'
import {
  buildCreateChatWorktreeOptions,
  selectCreateChatWorktreeSessionCounts
} from './create-chat-worktree-options'
import { createChatRepoOptions } from './create-chat-repo-options'
import type { CreateChatOptions } from './create-chat-selection'

/** Hosts, projects and their existing worktrees the create-chat composer can offer, read from store state. */
export function useCreateChatOptions(): CreateChatOptions {
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)

  const hosts = useMemo(
    () =>
      pickerExecutionHosts(
        buildExecutionHostRegistry({
          repos,
          settings,
          hostSource: 'configured-only',
          sshTargetLabels,
          sshConnectionStates,
          runtimeEnvironments,
          runtimeStatusByEnvironmentId,
          hostLabelOverrides: getHostDisplayLabelOverrides(settings)
        })
      ).map((host) => ({
        id: host.id,
        label: host.label,
        detail: host.detail,
        health: host.health
      })),
    [
      repos,
      settings,
      sshConnectionStates,
      sshTargetLabels,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId
    ]
  )

  const eligibleRepos = useMemo(() => createChatRepoOptions(repos), [repos])
  const repoIds = useMemo(() => eligibleRepos.map((repo) => repo.repoId), [eligibleRepos])
  const sessionCounts = useAppStore(
    useShallow((s) => selectCreateChatWorktreeSessionCounts(s, repoIds))
  )
  const worktrees = useMemo(
    () =>
      buildCreateChatWorktreeOptions({
        repos: eligibleRepos,
        worktreesByRepo,
        hosts,
        sessionCounts
      }),
    [eligibleRepos, worktreesByRepo, hosts, sessionCounts]
  )

  const preferredAgent = settings?.defaultTuiAgent
  return {
    hosts,
    repos: eligibleRepos,
    preferredAgent: preferredAgent && preferredAgent !== 'blank' ? preferredAgent : null,
    projectlessDirectory: settings?.projectlessChatsDir ?? '',
    worktrees
  }
}
