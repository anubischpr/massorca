// A chat's options, live or at rest.
//
// At rest nothing here needs a child. The pick is the record's own `options` — what the next start replays —
// and the list is the host's model catalog, the same one the picker already reads before a chat
// exists. A pick made at rest is written to the record as intent, through the same transition a live
// pick takes, so the next start applies it.

import {
  refuse,
  type AgentSessionOptionResult,
  type AgentSessionOptionsResult
} from '../../../shared/agent-session-wire'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { isPiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import { decodeStructuredAgentSessionOptionValue } from '../../../shared/structured-agent-session-option-codec'
import {
  agentSessionDeclaredAccess,
  supportsAgentSessionAccessMode,
  type AgentSessionExplicitAccess
} from '../../../shared/agent-session-access-mode'
import type { AgentSessionRecordStore } from '../../runtime/agent-session-record-store'
import { journalOpenReadRefusal } from '../agent-session-journal/journal-open-failure'
import type { StructuredAgentDefinition } from './structured-agent-definition'
import type { StructuredAgentRegistry } from './structured-agent-registry'
import type {
  StructuredAgentSessionAdapter,
  StructuredAgentSessionLiveOptions
} from './structured-agent-session-adapter'
import type { StructuredAgentSessionHostDeps } from './structured-agent-session-host-types'
import { structuredAgentSessionOptionModels } from './structured-agent-session-option-models'
import type { AgentSessionTurnContext, TurnOutcome } from './structured-agent-session-turns'
import { recordOnlyAccessPicks } from './structured-agent-session-access-posture'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-host-mutations'

type RestingOptions = Pick<AgentSessionOptionsResult, 'models' | 'fastModeSupport' | 'current'>

/** The at-rest rules of the record's agent, as this runtime registered it; null for any other. */
function restingOptionRules(
  agents: Pick<StructuredAgentRegistry, 'definition'>,
  record: AgentSessionRecord
): StructuredAgentDefinition['restingOptions'] | null {
  return agents.definition(record.provider)?.restingOptions ?? null
}

async function readStructuredAgentSessionOptionsAtRest(
  deps: Pick<StructuredAgentSessionHostDeps, 'store' | 'agents' | 'modelCatalog'>,
  sessionId: string
): Promise<RestingOptions> {
  const record = deps.store.getRecord(sessionId)
  if (!record) {
    throw new Error('agent_session_identity_required')
  }
  const rules = restingOptionRules(deps.agents, record)
  const catalog = (await deps.modelCatalog
    ?.read({ agent: record.provider, sessionId })
    .catch(() => null)) ?? { origin: 'unknown' as const }
  // With no catalog for the account, the list a running child of this agent falls back to.
  const listed = catalog.origin === 'unknown' ? (rules?.fallbackModels() ?? null) : catalog.models
  const models = listed ?? []
  const saved = record.options ?? {}
  const fastMode =
    saved.fastMode === undefined
      ? null
      : decodeStructuredAgentSessionOptionValue('fastMode', saved.fastMode)
  // An unknown model is one the client already treats as unconfirmed. Only a real listing names the
  // account's default; a built-in list's default is a guess, so with none the client keeps its own.
  const model =
    saved.model ??
    (catalog.origin === 'unknown' ? undefined : models.find((entry) => entry.isDefault)?.id)
  // As a live child answers: the pick, else the model's default where the agent reports that.
  const effort =
    saved.effort ??
    (rules?.effortDefaultsToModel
      ? models.find((entry) => entry.id === model)?.defaultEffort
      : undefined)
  return {
    models: listed ? structuredAgentSessionOptionModels(listed, model, (row) => row) : [],
    ...(catalog.origin !== 'unknown' && catalog.fastModeSupport
      ? { fastModeSupport: catalog.fastModeSupport }
      : {}),
    current: {
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(typeof fastMode === 'boolean' ? { fastMode } : {})
    }
  }
}

/** The modes a running child may switch to now: what its adapter can apply, within what the agent
 *  declares for this session's runtime. Empty for a session at rest. */
export function liveStructuredAgentSessionAccessModes(
  deps: {
    store: Pick<AgentSessionRecordStore, 'getRecord'>
    agents: Pick<StructuredAgentRegistry, 'definition'>
    adapter: Pick<StructuredAgentSessionAdapter, 'liveAccessModes'>
  },
  sessionId: string
): readonly AgentSessionExplicitAccess[] {
  const record = deps.store.getRecord(sessionId)
  const declared = record
    ? agentSessionDeclaredAccess(
        deps.agents.definition(record.provider)?.capabilities,
        record.options?.piRuntime
      )
    : undefined
  const live = deps.adapter.liveAccessModes?.(sessionId) ?? []
  return declared ? live.filter((mode) => declared.explicit.includes(mode)) : []
}

/** Records a pick for the next start. Only a key the provider would accept is kept. */
export async function recordStructuredAgentSessionOptionIntent(
  deps: {
    store: Pick<AgentSessionRecordStore, 'getRecord'>
    agents: Pick<StructuredAgentRegistry, 'definition'>
  },
  ctx: Pick<AgentSessionTurnContext, 'sessionId' | 'persistOptions' | 'publish'>,
  input: { key: string; value: string }
): Promise<TurnOutcome<AgentSessionOptionResult>> {
  const record = deps.store.getRecord(ctx.sessionId)
  const declared = record
    ? agentSessionDeclaredAccess(
        deps.agents.definition(record.provider)?.capabilities,
        record.options?.piRuntime
      )
    : undefined
  const acceptsAccessMode =
    input.key === 'accessMode' &&
    declared !== undefined &&
    supportsAgentSessionAccessMode(input.value, declared.explicit)
  if (
    !record ||
    !(input.key === 'accessMode'
      ? acceptsAccessMode
      : restingOptionRules(deps.agents, record)?.acceptsKey(input.key))
  ) {
    return {
      ok: false,
      refusal: refuse(
        'agent_session_operation_invalid',
        { reason: 'optionRejected' },
        `${record?.provider ?? 'This session'} has no session option named ${input.key}`
      )
    }
  }
  const options = { ...record.options, [input.key]: input.value }
  await ctx.persistOptions(options)
  ctx.publish()
  return { ok: true, value: { ...input, options } }
}

/** A live child's own answer, or the answer at rest; the goal, usage and rewind either way. */
export async function readStructuredAgentSessionOptions(
  context: Pick<
    StructuredAgentSessionMutationContext,
    'deps' | 'serialize' | 'openConversation' | 'conversation'
  >,
  sessionId: string
): Promise<AgentSessionOptionsResult> {
  const { adapter, agents, store } = context.deps
  const started = await context.serialize(sessionId, async () => {
    const session = await context.openConversation(sessionId).catch((error: unknown) => {
      throw journalOpenReadRefusal(error, context.deps.logger, sessionId)
    })
    const child = session?.child
    if (!child) {
      return { kind: 'rest' as const }
    }
    const prepared = adapter.prepareReadOptions?.({ sessionId, fence: child.fence })
    if (prepared) {
      return { kind: 'prepared' as const, child, prepared }
    }
    if (!adapter.readOptions) {
      throw new Error('structured_agent_session_options_unsupported')
    }
    return {
      kind: 'live' as const,
      options: await adapter.readOptions({ sessionId, fence: child.fence })
    }
  })
  const live: StructuredAgentSessionLiveOptions | null =
    started.kind === 'live'
      ? started.options
      : started.kind === 'prepared'
        ? await started.prepared.then((apply) =>
            context.serialize(sessionId, async () => {
              const child = (await context.openConversation(sessionId))?.child
              return child === started.child ? apply() : null
            })
          )
        : null
  let options: Omit<AgentSessionOptionsResult, 'rewind'>
  if (live) {
    const { catalogListing, ...answer } = live
    if (catalogListing) {
      // What a running child listed is its account's catalog too, so the next chat opens warm.
      context.deps.modelCatalog?.recordLiveListing(sessionId, catalogListing)
    }
    // A child that opts in lists no models of its own, so its picker reads the resting catalog.
    options =
      answer.models.length > 0 || adapter.modelsFromRestingCatalog?.(sessionId) !== true
        ? answer
        : {
            ...answer,
            models: (await readStructuredAgentSessionOptionsAtRest(context.deps, sessionId)).models
          }
  } else {
    options = await readStructuredAgentSessionOptionsAtRest(context.deps, sessionId)
  }
  // Re-acquired after the reads above: the handle they saw may have closed and reopened since.
  const session = await context.conversation(sessionId)
  const phase = store.getRecord(sessionId)?.rewind?.phase
  const agent = session.params.provider
  const record = store.getRecord(sessionId)
  const declaredAccess = agentSessionDeclaredAccess(
    agents.definition(agent)?.capabilities,
    record?.options?.piRuntime
  )
  const liveAccessModes = liveStructuredAgentSessionAccessModes(context.deps, sessionId)
  const candidates = declaredAccess ? ['inherit' as const, ...declaredAccess.explicit] : []
  // A child whose access is fixed at launch takes each declared pick at its next start, not live.
  const nextStartModes =
    session.child && adapter.takesAccessAtNextStart?.(sessionId) === true
      ? candidates.filter((mode) => !liveAccessModes.some((live) => live === mode))
      : []
  // Picks the running child already satisfies: they only move the record, so they may be taken live.
  const satisfiedModes = session.child
    ? recordOnlyAccessPicks({
        deps: context.deps,
        sessionId,
        running: session.child.accessPosture,
        candidates
      })
    : []
  const recordOnlyModes = candidates.filter(
    (mode) =>
      (satisfiedModes.includes(mode) || nextStartModes.includes(mode)) &&
      !liveAccessModes.some((live) => live === mode)
  )
  const capabilities = agents.capabilities(agent)
  const runnable = adapter.availableProviderCommands?.(sessionId)
  const declaredProviderCommands = (capabilities?.providerCommands ?? []).filter(
    (command) => runnable === undefined || runnable.includes(command)
  )
  const recordedPiRuntime = record?.options?.piRuntime
  const floor = session.journal.context.floor()
  const contextFloor = floor ? { contextFloor: floor } : {}
  const presentPicker = agents.definition(agent)?.restingOptions.presentPicker
  const shown = presentPicker
    ? { ...options, ...presentPicker({ models: options.models, current: options.current }) }
    : options
  return {
    ...shown,
    // The runtime the host recorded for this chat, so a client that never held it resumes the same one.
    ...(agent === 'pi' && isPiRuntimeSelection(recordedPiRuntime)
      ? { piRuntime: recordedPiRuntime }
      : {}),
    ...(declaredAccess
      ? {
          accessModeSupport: {
            modes: declaredAccess.modes,
            // Absent when the agent declares none; a client that predates presets ignores it.
            ...(declaredAccess.presets.length > 0 ? { presets: declaredAccess.presets } : {}),
            settable: !session.child,
            // `settable` keeps its meaning for older clients; a newer one adds what may change live.
            ...(session.child && liveAccessModes.length > 0 ? { liveModes: liveAccessModes } : {}),
            ...(recordOnlyModes.length > 0 ? { recordOnlyModes } : {}),
            // Picks the running child takes at its next start, so the client can say so beside them.
            ...(nextStartModes.length > 0 ? { nextStartModes } : {})
          },
          current: {
            ...shown.current,
            accessMode:
              record?.options?.accessMode &&
              supportsAgentSessionAccessMode(record.options.accessMode, declaredAccess.explicit)
                ? record.options.accessMode
                : 'inherit'
          }
        }
      : {}),
    rewind:
      phase === 'prepared' || phase === 'provider-succeeded'
        ? { supported: false, reason: 'outcome-unknown' }
        : (adapter.rewindSupport?.(sessionId, agent) ?? {
            supported: false,
            reason: 'unsupported'
          }),
    conversationCommands: capabilities?.compact ? ['clear', 'compact'] : ['clear'],
    ...(declaredProviderCommands.length > 0 ? { providerCommands: declaredProviderCommands } : {}),
    ...(capabilities?.threadGoal
      ? { threadGoal: { current: session.journal.threadGoal(), ...contextFloor } }
      : {}),
    ...(capabilities?.contextUsage
      ? { contextUsage: { current: session.journal.contextUsage(), ...contextFloor } }
      : {})
  }
}
