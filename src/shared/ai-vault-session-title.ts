import type { AiVaultAgent } from './ai-vault-types'
import type { ExecutionHostId } from './execution-host'

export const AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT = 64

/** Agents whose transcript title the host reads: each has a local transcript it can parse by path or id. */
export const AI_VAULT_TITLE_AGENTS = ['claude', 'codex', 'pi', 'antigravity'] as const

export type AiVaultSessionTitle = {
  agent: Extract<AiVaultAgent, (typeof AI_VAULT_TITLE_AGENTS)[number]>
  sessionId: string
  title: string
}

export type AiVaultSessionTitleRequest = {
  agent: AiVaultSessionTitle['agent']
  sessionId: string
  transcriptPath?: string
}

export type AiVaultSessionTitlesArgs = {
  executionHostScope?: ExecutionHostId
  requests: AiVaultSessionTitleRequest[]
}

export type AiVaultSessionTitlesResult = {
  titles: AiVaultSessionTitle[]
}

export function isAiVaultTitleAgent(
  agent: string | null | undefined
): agent is AiVaultSessionTitle['agent'] {
  return AI_VAULT_TITLE_AGENTS.some((titleAgent) => titleAgent === agent)
}
