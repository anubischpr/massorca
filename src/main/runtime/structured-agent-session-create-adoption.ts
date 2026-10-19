import { getClaudeProfileRouter } from '../claude-accounts/claude-profile-installed-router'
import { agentSessionRefusalError } from '../../shared/agent-session-wire-refusals'
import {
  isAntigravityAgentSessionAccountHome,
  isLegacyAgentSessionAccountHome,
  type AgentSessionAccountHome,
  type AntigravityAgentSessionAccountHome
} from '../../shared/agent-session-account-home'
import {
  isAgentSessionAdoptableProvider,
  type AgentSessionAdoptableProvider
} from '../../shared/agent-session-provider-handle'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSessionExecutionLocation } from '../../shared/agent-session-record'
import { agentSessionExecutionLocationsEqual } from '../../shared/agent-session-record'
import type { AgentSessionAttachParams } from '../native-chat/agent-session-wire/structured-agent-session-attach'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'
import { listStructuredProviderSessionOwnership } from '../native-chat/agent-session-wire/structured-provider-session-ownership'
import {
  findCommittedStructuredAgentSessionAdoptionReplay,
  findConflictingStructuredAdoption,
  resolveStructuredAgentSessionAdoption,
  structuredAdoptionConflictError
} from '../native-chat/structured-agent-session-history-adoption'
import { getPtyIdForPaneKey } from '../ipc/pty/pane/key-state'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { assertNoLiveTerminalHoldsProviderSession } from './structured-adoption-live-terminal-guard'
import { resolveSessionFilePath } from '../native-chat/session-file-resolver'
import { configuredAdditionalCodexHomePaths } from '../ai-vault/cached-session-list'
import { getOrcaManagedCodexHomePath, getSystemCodexHomePath } from '../codex/codex-home-paths'

type AdoptionSettings = {
  codexManagedAccounts?: readonly { managedHomePath: string }[]
}

export function resolveCommittedStructuredAgentSessionAdoptionIntent(input: {
  host: StructuredAgentSessionHost | null
  envelope: { sessionId: string; clientOperationId: string }
  agent: AgentSessionAdoptableProvider
  callerKey?: string
  resumeFrom?: { providerSessionId: string }
  location: AgentSessionExecutionLocation
  options?: Readonly<Record<string, string>>
}): AgentSessionAttachParams | null {
  const replay =
    input.resumeFrom && input.callerKey && input.host
      ? findCommittedStructuredAgentSessionAdoptionReplay({
          agent: input.agent,
          providerSessionId: input.resumeFrom.providerSessionId,
          selfSessionId: input.envelope.sessionId,
          callerKey: input.callerKey,
          operationId: input.envelope.clientOperationId,
          record: input.host.deps.store.getRecord(input.envelope.sessionId),
          operations: input.host.deps.store.listOperationRows()
        })
      : null
  if (!replay || !agentSessionExecutionLocationsEqual(replay.record.location, input.location)) {
    return null
  }
  return {
    envelope: {
      sessionId: input.envelope.sessionId,
      clientOperationId: input.envelope.clientOperationId,
      expectedRuntimeFence: null,
      payloadFingerprint: ''
    },
    location: input.location,
    provider: input.agent,
    agent: input.agent,
    accountHome: replay.record.accountHome,
    ...(input.options ? { options: input.options } : {}),
    adopt: { providerHandle: replay.providerHandle },
    runtimeKind: 'native'
  }
}

/** The admission every adoption shares: no other live writer holds the conversation, and no live
 *  terminal pane still reports it. Both refuse before any transcript is read. */
export function assertStructuredAdoptionAdmissible(input: {
  host: StructuredAgentSessionHost | null
  agent: AgentSessionAdoptableProvider
  providerSessionId: string
  selfSessionId: string
  providerSessionRows: readonly { paneKey: string; providerSession?: { id: string } }[]
}): void {
  const conflict = input.host
    ? findConflictingStructuredAdoption({
        agent: input.agent,
        providerSessionId: input.providerSessionId,
        selfSessionId: input.selfSessionId,
        ownership: listStructuredProviderSessionOwnership(input.host.deps.store.listRecords())
      })
    : null
  if (conflict) {
    throw structuredAdoptionConflictError(conflict)
  }
  assertNoLiveTerminalHoldsProviderSession({
    identities: input.providerSessionRows.flatMap((row) =>
      row.providerSession ? [{ paneKey: row.paneKey, sessionId: row.providerSession.id }] : []
    ),
    providerSessionId: input.providerSessionId,
    // The pane-to-PTY map is cleared on PTY teardown, so a mapped pane has a live PTY.
    isPaneKeyPtyLive: (paneKey) => getPtyIdForPaneKey(paneKey) !== undefined
  })
}

/**
 * Antigravity's `agy --conversation <id>` reads the conversation from the account home it runs
 * under, so the transcript is searched there and the account home is pinned unchanged.
 */
export async function resolveAntigravityStructuredAgentSessionAdoptionForCreate(input: {
  host?: StructuredAgentSessionHost | null
  providerSessionId: string
  selfSessionId: string
  selectedAccountHome: AntigravityAgentSessionAccountHome
  providerSessionRows: readonly { paneKey: string; providerSession?: { id: string } }[]
}): Promise<{ transcriptPath: string }> {
  const host = input.host === undefined ? getStructuredAgentSessionHost() : input.host
  assertStructuredAdoptionAdmissible({
    host,
    agent: 'antigravity',
    providerSessionId: input.providerSessionId,
    selfSessionId: input.selfSessionId,
    providerSessionRows: input.providerSessionRows
  })
  const transcriptPath = await resolveSessionFilePath('antigravity', input.providerSessionId, {
    antigravityHomeDir: input.selectedAccountHome.locator.home
  })
  if (!transcriptPath) {
    throw agentSessionRefusalError('agent_session_identity_required', {
      reason: 'transcriptNotFound'
    })
  }
  return { transcriptPath }
}

/** The account home a resume pins and the transcript the import reads, for an adoptable agent. */
export async function resolveResumeFromAdoptionForCreate(input: {
  host?: StructuredAgentSessionHost | null
  settings: AdoptionSettings
  agent: string
  providerSessionId: string
  selfSessionId: string
  selectedAccountHome: AgentSessionAccountHome
  providerSessionRows: readonly { paneKey: string; providerSession?: { id: string } }[]
}): Promise<{ accountHome: AgentSessionAccountHome; transcriptPath: string }> {
  if (!isAgentSessionAdoptableProvider(input.agent)) {
    throw agentSessionRefusalError('structured_agent_session_unsupported', {
      reason: 'hostUnsupported'
    })
  }
  if (input.agent === 'antigravity') {
    if (!isAntigravityAgentSessionAccountHome(input.selectedAccountHome)) {
      throw agentSessionRefusalError('structured_agent_session_unsupported', {
        reason: 'hostUnsupported'
      })
    }
    const { transcriptPath } = await resolveAntigravityStructuredAgentSessionAdoptionForCreate({
      host: input.host,
      providerSessionId: input.providerSessionId,
      selfSessionId: input.selfSessionId,
      selectedAccountHome: input.selectedAccountHome,
      providerSessionRows: input.providerSessionRows
    })
    return { accountHome: input.selectedAccountHome, transcriptPath }
  }
  if (!isLegacyAgentSessionAccountHome(input.selectedAccountHome)) {
    throw agentSessionRefusalError('structured_agent_session_unsupported', {
      reason: 'hostUnsupported'
    })
  }
  // Adopting pins the account home to wherever the conversation actually lives, which is not
  // necessarily the one a fresh create would pick: Codex resolves its rollout under
  // `accountHome.path`, and Claude reads its transcript under `<home>/projects`. Resuming under
  // the wrong home finds nothing and lands the user in a blank chat wearing the old chat's name.
  const adoption = await resolveStructuredAgentSessionAdoptionForCreate({
    host: input.host,
    settings: input.settings,
    agent: input.agent,
    providerSessionId: input.providerSessionId,
    selfSessionId: input.selfSessionId,
    selectedAccountHomePath: input.selectedAccountHome.path,
    providerSessionRows: input.providerSessionRows
  })
  return {
    accountHome: { variable: input.selectedAccountHome.variable, path: adoption.accountHomePath },
    transcriptPath: adoption.transcriptPath
  }
}

export async function resolveStructuredAgentSessionAdoptionForCreate(input: {
  /** The structured host whose records may already hold the conversation; the registered one by default. */
  host?: StructuredAgentSessionHost | null
  settings: AdoptionSettings
  agent: 'claude' | 'codex'
  providerSessionId: string
  selfSessionId: string
  selectedAccountHomePath: string
  /** Provider-session rows this host holds, including those of terminal panes. */
  providerSessionRows: readonly { paneKey: string; providerSession?: { id: string } }[]
}) {
  const host = input.host === undefined ? getStructuredAgentSessionHost() : input.host
  assertStructuredAdoptionAdmissible({
    host,
    agent: input.agent,
    providerSessionId: input.providerSessionId,
    selfSessionId: input.selfSessionId,
    providerSessionRows: input.providerSessionRows
  })
  return resolveStructuredAgentSessionAdoption({
    agent: input.agent,
    providerSessionId: input.providerSessionId,
    candidateAccountHomes: structuredAdoptionAccountHomeCandidates(input),
    resolveTranscript: async ({ agent, providerSessionId, accountHomePath }) =>
      resolveSessionFilePath(
        agent,
        providerSessionId,
        agent === 'claude'
          ? { claudeProjectsDir: join(accountHomePath, 'projects') }
          : { codexSessionsDirs: [join(accountHomePath, 'sessions')] }
      )
  })
}

/** Recognised adoption homes, most-preferred first. */
function structuredAdoptionAccountHomeCandidates(input: {
  settings: AdoptionSettings
  agent: 'claude' | 'codex'
  selectedAccountHomePath: string
}): string[] {
  if (input.agent === 'claude') {
    return [
      input.selectedAccountHomePath,
      join(homedir(), '.claude'),
      ...(getClaudeProfileRouter()?.accountHomes() ?? [])
    ]
  }
  return [
    input.selectedAccountHomePath,
    ...(input.settings.codexManagedAccounts ?? []).map((account) => account.managedHomePath),
    ...configuredAdditionalCodexHomePaths(),
    getOrcaManagedCodexHomePath(),
    getSystemCodexHomePath()
  ]
}
