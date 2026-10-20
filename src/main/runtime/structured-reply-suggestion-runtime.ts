import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../shared/execution-host'
import { lastReplySuggestionExchange } from '../../shared/native-chat-reply-suggestion'
import { resolvePiRuntime } from '../../shared/pi-runtime-selection'
import type { ResolvedSourceControlAiGenerationParams } from '../../shared/source-control-ai'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import {
  replySuggestionCommandOverride,
  selectReplySuggestionAgent
} from '../native-chat/reply-suggestion-agent-selection'
import type { StructuredReplySuggestionDeps } from '../native-chat/structured-reply-suggestion'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'
import { cancelLocalGeneration } from '../text-generation/source-control-generation-lanes'
import { generateReplySuggestion } from '../text-generation/reply-suggestion-generation-request'
import type { Store } from '../persistence'

type StructuredReplySuggestionRuntime = {
  resolveWorkspace: (
    workspaceId: string
  ) => Promise<{ path: string; executionHostId: ExecutionHostId }>
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
  hasOpenDispatch: StructuredReplySuggestionDeps['hasOpenDispatch']
}

/**
 * Wires the suggestion handler to the runtime that owns the chat host. On a paired Orca server that
 * is the server itself, so the model call runs there with the account its agent already uses and
 * nothing is sent from the client.
 */
export function structuredReplySuggestionDeps(
  getStore: () => Pick<Store, 'getSettings'>,
  runtime: StructuredReplySuggestionRuntime,
  logger: StructuredAgentSessionLogger
): StructuredReplySuggestionDeps {
  // Where each call runs, so a new turn can stop it; the text-generation lane is keyed by directory.
  const runningIn = new Map<string, string>()
  return {
    getSettings: () => getStore().getSettings(),
    getRecord: (sessionId) =>
      getStructuredAgentSessionHost()?.deps.store.getRecord(sessionId) ?? undefined,
    hasOpenDispatch: runtime.hasOpenDispatch,
    readExchange: async (sessionId) => {
      const host = getStructuredAgentSessionHost()
      return host
        ? lastReplySuggestionExchange((await host.journalSnapshot(sessionId)).items)
        : null
    },
    readHeld: (sessionId) => getStructuredAgentSessionHost()?.promptSuggestions.get(sessionId),
    generate: async (record, exchange) => {
      const host = getStructuredAgentSessionHost()
      const settings = getStore().getSettings()
      const storedRuntime = record.options?.piRuntime
      const codexModelIds =
        record.provider === 'codex' && host?.deps.modelCatalog
          ? await host.deps.modelCatalog
              .read({ agent: 'codex', sessionId: record.sessionId, savedOnly: true })
              .then((catalog) =>
                'models' in catalog ? catalog.models.map((model) => model.id) : []
              )
          : []
      const piRuntime = resolvePiRuntime({
        hostRecorded: storedRuntime,
        command: settings.agentCmdOverrides?.pi
      })
      const agent = selectReplySuggestionAgent({
        provider: record.provider,
        sessionModel: record.options?.model,
        codexModelIds
      })
      const workspace = await runtime.resolveWorkspace(record.location.workspaceId)
      // Structured chats execute natively on this host; SSH and WSL workspaces get no suggestion.
      if (
        !agent ||
        workspace.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
        record.location.wslDistro !== null
      ) {
        return null
      }
      const target = await resolveGenerationTarget(workspace.path, agent.agentId, null, runtime)
      if (!target) {
        return null
      }
      const override = replySuggestionCommandOverride(agent.agentId, piRuntime, settings)
      const params: ResolvedSourceControlAiGenerationParams = {
        agentId: agent.agentId,
        model: agent.model,
        ...(override ? { agentCommandOverride: override } : {})
      }
      runningIn.set(record.sessionId, workspace.path)
      try {
        const result = await generateReplySuggestion({
          exchange,
          params,
          target,
          spawnAgent: spawnSourceControlAgent
        })
        if (!result.success) {
          if (!result.canceled) {
            logger.warn(result.error, { scope: 'reply-suggestion', sessionId: record.sessionId })
          }
          return null
        }
        return result.text
      } finally {
        runningIn.delete(record.sessionId)
      }
    },
    cancelGeneration: (sessionId) => {
      const cwd = runningIn.get(sessionId)
      if (cwd !== undefined) {
        cancelLocalGeneration('reply-suggestion', cwd)
      }
    },
    publish: (sessionId, suggestion) =>
      getStructuredAgentSessionHost()?.promptSuggestions.publish(sessionId, suggestion),
    logger
  }
}
