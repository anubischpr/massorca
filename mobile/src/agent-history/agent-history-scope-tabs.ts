import type { AiVaultScope } from '../../../src/shared/ai-vault-types'

export type AgentHistoryScopeTab = { scope: AiVaultScope; label: string }

// Why: a folder workspace is a plain folder, not a git worktree, so its scope names the folder.
export function agentHistoryScopeTabs(activeWorkspaceIsFolder: boolean): AgentHistoryScopeTab[] {
  return [
    { scope: 'workspace', label: activeWorkspaceIsFolder ? 'This folder' : 'This worktree' },
    { scope: 'project', label: 'Project' },
    { scope: 'all', label: 'All' }
  ]
}
