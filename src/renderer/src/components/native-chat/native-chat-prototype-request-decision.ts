// What the composer does with a message that may ask for prototypes.
import {
  classifyPrototypeRequest,
  type PrototypeAgent,
  type PrototypeRequest
} from '../../../../shared/prototype-request'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'

/** The answer of the "How many prototypes?" card: a count, or the message as typed. */
export type NativeChatPrototypeChoice = { count: number } | 'as-typed'

export type NativeChatPrototypeDecision =
  | { kind: 'as-typed' }
  | { kind: 'create'; count: number }
  | {
      kind: 'ask'
      /** A keyword match, not a command: the card then also offers "Not a prototype". */
      keyword: boolean
    }

export function decideNativeChatPrototypeRequest(input: {
  text: string
  agent: PrototypeAgent
  setting: PrototypeCountSetting
  choice?: NativeChatPrototypeChoice
}): NativeChatPrototypeDecision {
  const request: PrototypeRequest = classifyPrototypeRequest(input.text, input.agent)
  if (request.kind === 'none' || input.choice === 'as-typed') {
    return { kind: 'as-typed' }
  }
  if (input.choice) {
    return { kind: 'create', count: input.choice.count }
  }
  // An explicit command applies the setting; a keyword match always asks.
  if (request.kind === 'command' && input.setting.mode === 'always') {
    return { kind: 'create', count: input.setting.count }
  }
  return { kind: 'ask', keyword: request.kind === 'keyword' }
}
