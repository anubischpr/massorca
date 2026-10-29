import { isAgentSessionHandleProvider } from '../../../src/shared/agent-session-provider-handle'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import type {
  SessionOptionDescriptor,
  SessionOptionValue
} from '../../../src/shared/native-chat-session-options'
import { resolveEffectiveNativeChatModelId } from '../../../src/shared/native-chat-session-option-snapshot'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import { structuredAgentSessionSeedCatalog } from '../../../src/shared/structured-agent-session-seed-catalog'
import { encodeStructuredAgentSessionOptionValue } from '../../../src/shared/structured-agent-session-option-codec'
import {
  applyStructuredAgentSessionModelCatalog,
  canSetStructuredAgentSessionOption,
  commitStructuredAgentSessionOption,
  createStructuredAgentSessionOptionState,
  settleStructuredAgentSessionBuiltinCatalog,
  structuredAgentSessionOptionSnapshot,
  type StructuredAgentSessionOptionState
} from '../../../src/shared/structured-agent-session-options'
import { createSessionAccessSupport } from './create-session-access-support'
import type { CreateSessionPicks } from './create-session-launch-plan'

/** Agents whose option list the create screen reads from the host, beyond the structured chats. */
const HOST_LISTED_CREATE_AGENTS: readonly string[] = ['antigravity', 'pi']

/** Whether the create screen can describe an agent's pickers before its chat exists. */
export function createSessionReadsHostOptions(agent: string | null): boolean {
  return (
    agent !== null &&
    (isAgentSessionHandleProvider(agent) || HOST_LISTED_CREATE_AGENTS.includes(agent))
  )
}

/**
 * The model, effort, fast and access pickers before any session exists. It reuses the structured
 * chat's own option state so the same pickers render, and keeps what the user explicitly chose in
 * `picks` so an untouched option stays the host's default.
 */
export type CreateSessionOptionDraft = {
  agent: string | null
  /** Host and project the picks were made for; another one starts over. */
  scope: string
  /** Pi's access modes differ by runtime, so the draft records the runtime it was made for. */
  piRuntime: PiRuntimeSelection | null
  state: StructuredAgentSessionOptionState | null
  picks: CreateSessionPicks
}

export function createCreateSessionOptionDraft(
  agent: string | null,
  scope = '',
  piRuntime: PiRuntimeSelection | null = null
): CreateSessionOptionDraft {
  // A terminal-only agent has no pickers the create screen can describe.
  if (!agent || !createSessionReadsHostOptions(agent)) {
    return { agent, scope, piRuntime, state: null, picks: {} }
  }
  const access = createSessionAccessSupport(agent, piRuntime)
  return {
    agent,
    scope,
    piRuntime,
    state: createStructuredAgentSessionOptionState(
      agent,
      // Why: only structured chats have a built-in list; the others take models from the host.
      isAgentSessionHandleProvider(agent) ? structuredAgentSessionSeedCatalog(agent) : null,
      access?.modes,
      access?.presets
    ),
    picks: {}
  }
}

/** The host's saved model list replaces the built-in one; no list leaves the built-in usable. */
export function applyCreateSessionModelCatalog(
  draft: CreateSessionOptionDraft,
  catalog: AgentSessionModelCatalogResult | null
): CreateSessionOptionDraft {
  if (!draft.state || !draft.agent) {
    return draft
  }
  const state = catalog
    ? applyStructuredAgentSessionModelCatalog(
        draft.state,
        structuredAgentSessionSeedCatalog(draft.agent),
        catalog,
        { newLaunch: true }
      )
    : settleStructuredAgentSessionBuiltinCatalog(draft.state)
  return { ...draft, state }
}

export function createSessionOptionSnapshot(
  draft: CreateSessionOptionDraft
): SessionOptionDescriptor[] {
  return draft.state ? structuredAgentSessionOptionSnapshot(draft.state) : []
}

/** Null when the pick is not offered, so a stale tap changes nothing. */
export function pickCreateSessionOption(
  draft: CreateSessionOptionDraft,
  id: string,
  value: SessionOptionValue
): CreateSessionOptionDraft | null {
  const encoded = encodeStructuredAgentSessionOptionValue(id, value)
  if (
    !draft.state ||
    encoded === null ||
    !canSetStructuredAgentSessionOption(draft.state, id, value)
  ) {
    return null
  }
  const state = commitStructuredAgentSessionOption(draft.state, id, encoded)
  if (id === 'model' && typeof value === 'string') {
    // Why: effort and fast belong to the model they were picked for, so a new model starts clean.
    delete state.record.valuesByModel[value]
    return { ...draft, state, picks: { ...withoutModelBoundPicks(draft.picks), model: value } }
  }
  if (id === 'effort' && typeof value === 'string') {
    return { ...draft, state, picks: { ...draft.picks, effort: value } }
  }
  if (id === 'fastMode' && typeof value === 'boolean') {
    return { ...draft, state, picks: { ...draft.picks, fastMode: value } }
  }
  if (id === 'accessMode' && typeof value === 'string') {
    return { ...draft, state, picks: { ...draft.picks, accessMode: value } }
  }
  return { ...draft, state }
}

function withoutModelBoundPicks(picks: CreateSessionPicks): CreateSessionPicks {
  const { effort: _effort, fastMode: _fastMode, ...rest } = picks
  return rest
}

export function createSessionEffectiveModelId(draft: CreateSessionOptionDraft): string | null {
  const catalog = draft.state?.catalog
  return draft.state && catalog
    ? resolveEffectiveNativeChatModelId(catalog, catalog.models, draft.state.record)
    : null
}
