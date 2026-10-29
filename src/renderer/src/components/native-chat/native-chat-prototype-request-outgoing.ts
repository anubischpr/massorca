// What a structured send puts on the wire when its text may ask for prototypes: the text itself,
// the text with its hidden instruction, or nothing yet because the card must ask how many.
import type { AgentType } from '../../../../shared/agent-status-types'
import { sanitizePrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import { neutralizePrototypeMarkers } from '../../../../shared/prototype-hidden-instruction'
import { currentPiDisplayRuntime } from '@/lib/pi-display-runtime-now'
import { readChatPiRuntime } from '@/lib/chat-pi-runtime-record'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { useAppStore } from '@/store'
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type { NativeChatComposerDraft } from './native-chat-composer-draft-storage'
import { prototypeAgentDisplayName, prototypeAgentForChat } from './native-chat-prototype-agent'
import {
  decideNativeChatPrototypeRequest,
  type NativeChatPrototypeChoice
} from '../../../../shared/prototype-request-decision'
import { prepareNativeChatPrototypeText } from './native-chat-prototype-request-send'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'

export type NativeChatPrototypeOutgoing =
  | { kind: 'ask' }
  | { kind: 'in-flight' }
  | { kind: 'send'; text: string }

// A request is made once per press: a second Enter while the host answers waits for the first.
const inFlight = new Set<string>()

/** Settled at once for text sent as typed or held for the card; a promise only while the host makes a request folder. */
export function resolveNativeChatPrototypeOutgoing(input: {
  text: string
  agent: AgentType
  draftScopeKey: string
  attachments: readonly NativeChatComposerImageAttachment[]
  sentFrom: NativeChatComposerDraft
  sessionId: string
  worktreeId?: string
  runtimeEnvironmentId: string | null
  choice?: NativeChatPrototypeChoice
}): NativeChatPrototypeOutgoing | Promise<NativeChatPrototypeOutgoing | null> {
  const { draftScopeKey } = input
  // Markers in typed or pasted text are never MassOrca's; only the ones built below may remain.
  const text = neutralizePrototypeMarkers(input.text)
  // Only a Pi chat can be Gentle Shell; asking the host which runtime it is costs a call.
  const chatRuntime = input.agent === 'pi' ? readChatPiRuntime(input.sessionId) : undefined
  const piRuntime =
    input.agent === 'pi'
      ? currentPiDisplayRuntime({
          ...(input.worktreeId ? { worktreeId: input.worktreeId } : {}),
          ...(chatRuntime ? { chatRuntime } : {})
        })
      : 'unknown'
  const prototypeAgent = prototypeAgentForChat(input.agent, piRuntime)
  const setting = sanitizePrototypeCountSetting(useAppStore.getState().settings?.prototypeCount)
  const decision = decideNativeChatPrototypeRequest({
    text,
    agent: prototypeAgent,
    setting,
    ...(input.choice ? { choice: input.choice } : {})
  })
  // Any other message sent meanwhile retires a card still waiting for its answer.
  nativeChatPrototypeAsks.take(draftScopeKey)
  if (decision.kind === 'as-typed') {
    return { kind: 'send', text }
  }
  if (decision.kind === 'ask') {
    nativeChatPrototypeAsks.write(draftScopeKey, {
      text,
      attachments: input.attachments,
      sentFrom: input.sentFrom,
      keyword: decision.keyword,
      settingAsks: setting.mode === 'ask',
      defaultCount: setting.count,
      agentName: prototypeAgentDisplayName(input.agent, piRuntime)
    })
    return { kind: 'ask' }
  }
  if (inFlight.has(draftScopeKey)) {
    return { kind: 'in-flight' }
  }
  inFlight.add(draftScopeKey)
  const target: RuntimeClientTarget =
    input.runtimeEnvironmentId === null
      ? { kind: 'local' }
      : { kind: 'environment', environmentId: input.runtimeEnvironmentId }
  return prepareNativeChatPrototypeText({
    target,
    sessionId: input.sessionId,
    ...(input.worktreeId ? { worktreeId: input.worktreeId } : {}),
    agent: prototypeAgent,
    text,
    count: decision.count
  })
    .then((prepared): NativeChatPrototypeOutgoing => ({ kind: 'send', text: prepared }))
    .finally(() => {
      inFlight.delete(draftScopeKey)
    })
}
