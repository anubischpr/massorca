import {
  buildQuickComposerStartup,
  type QuickComposerStartup
} from '@/hooks/composer-state/quick-startup-plan'
import { getAgentLaunchPlatformForRepo } from '@/lib/agent-launch-platform'
import { getLocalRepoProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import { CLIENT_PLATFORM } from '@/lib/new-workspace'
import { useAppStore } from '@/store'
import { repoIsRemote } from '../../../../shared/agent-launch-remote'
import type { Repo } from '../../../../shared/repo-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { resolveLocalWindowsAgentStartupShell } from '../../../../shared/windows-terminal-shell'

/** The agent's terminal startup for a new worktree of `repo`, on the platform and shell that repo launches on. */
export function buildCreateChatTerminalStartup(
  repo: Repo,
  agent: TuiAgent,
  draft: string
): QuickComposerStartup {
  const state = useAppStore.getState()
  const projectRuntime = repo.connectionId
    ? undefined
    : getLocalRepoProjectExecutionRuntimeContext(
        {
          activeRepoId: state.activeRepoId,
          activeWorktreeId: null,
          projects: state.projects,
          repos: state.repos,
          settings: state.settings,
          worktreesByRepo: state.worktreesByRepo
        },
        repo.id,
        CLIENT_PLATFORM
      )
  const platform = getAgentLaunchPlatformForRepo(repo, projectRuntime)
  const isRemote = repoIsRemote(repo)
  return buildQuickComposerStartup({
    agent,
    prompt: draft,
    draftPrompt: null,
    settings: state.settings,
    platform,
    shell: resolveLocalWindowsAgentStartupShell({
      platform,
      isRemote,
      terminalWindowsShell: state.settings?.terminalWindowsShell
    }),
    isRemote,
    telemetrySource: undefined
  })
}
