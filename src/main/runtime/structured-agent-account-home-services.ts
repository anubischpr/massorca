import type { GlobalSettings } from '../../shared/global-settings-types'
import type {
  StructuredClaudeAccountHomeDeps,
  StructuredCodexAccountHomeDeps
} from './structured-agent-account-home'

/** Host services shared by account resolution before a session or catalog acquisition. */
export type StructuredAgentAccountHomeServices = {
  getClaudeConfigDirectory: StructuredClaudeAccountHomeDeps['getClaudeConfigDirectory']
  prepareCodexLaunchHome: StructuredCodexAccountHomeDeps['resolveLaunchHome']
  readCodexLaunchHome: StructuredCodexAccountHomeDeps['resolveLaunchHome']
  workspaceTrustSettings: () => Pick<
    GlobalSettings,
    | 'agentWorkspaceTrustEnabled'
    | 'nativeChatInheritShellEnvironment'
    | 'nativeChatShellEnvironmentVariables'
  >
}
