import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host-registry'
import { pickerExecutionHosts } from '../../../../shared/managed-orcad-execution-host'
import { createChatRepoOptions } from './create-chat-repo-options'
import type { CreateChatOptions } from './create-chat-selection'

/** Hosts and projects the create-chat composer can offer, read from store state. */
export function useCreateChatOptions(): CreateChatOptions {
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)

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

  const preferredAgent = settings?.defaultTuiAgent
  return {
    hosts,
    repos: eligibleRepos,
    preferredAgent: preferredAgent && preferredAgent !== 'blank' ? preferredAgent : null,
    projectlessDirectory: settings?.projectlessChatsDir ?? ''
  }
}
