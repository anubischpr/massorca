// What a mobile composer send does with a message that may ask for prototypes: the same decision
// table as desktop, then the request folder on the host and the hidden instruction behind the text.
import type { PrototypeCountSetting } from '../../../src/shared/prototype-count-setting'
import { neutralizePrototypeMarkers } from '../../../src/shared/prototype-hidden-instruction'
import {
  buildPrototypeRequestMessage,
  classifyPrototypeRequest,
  isUsablePrototypeRequestFolder,
  type PrototypeAgent
} from '../../../src/shared/prototype-request'
import {
  decideNativeChatPrototypeRequest,
  type NativeChatPrototypeChoice
} from '../../../src/shared/prototype-request-decision'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../../src/shared/rpc-contract/prototype-params'
import type { MobilePrototypeRequest } from '../session/mobile-prototype-host-rpc'

export type MobilePrototypeAskDetails = {
  /** A keyword match, not a command: the card also offers "Not a prototype". */
  keyword: boolean
  /** The count Settings makes the primary button. */
  defaultCount: number
}

export type MobilePrototypeOutgoing =
  /** `wireText` goes to the agent; `shownText` is what the chat shows and the pending echo matches. */
  | { kind: 'send'; wireText: string; shownText: string }
  | ({ kind: 'ask' } & MobilePrototypeAskDetails)

export type MobilePrototypePlanInput = {
  /** The text as typed; markers in it are never MassOrca's. */
  text: string
  agent: PrototypeAgent
  /** Read only when the text asks for prototypes. */
  readSetting: () => Promise<PrototypeCountSetting>
  /** Makes the request folder on the chat's host; null when the chat cannot make one. */
  createRequest:
    | ((params: { text: string; count: number }) => Promise<MobilePrototypeRequest>)
    | null
  choice?: NativeChatPrototypeChoice
}

export async function planMobilePrototypeOutgoing(
  input: MobilePrototypePlanInput
): Promise<MobilePrototypeOutgoing> {
  const text = neutralizePrototypeMarkers(input.text)
  const asTyped: MobilePrototypeOutgoing = { kind: 'send', wireText: text, shownText: text }
  if (classifyPrototypeRequest(text, input.agent).kind === 'none') {
    return asTyped
  }
  const setting = await input.readSetting()
  const decision = decideNativeChatPrototypeRequest({
    text,
    agent: input.agent,
    setting,
    ...(input.choice ? { choice: input.choice } : {})
  })
  if (decision.kind === 'as-typed') {
    return asTyped
  }
  if (decision.kind === 'ask') {
    return { kind: 'ask', keyword: decision.keyword, defaultCount: setting.count }
  }
  // Too long to record, or no folder to make: the message goes as typed, with no capture.
  if (text.length > PROTOTYPE_PROMPT_MAX_LENGTH || input.createRequest === null) {
    return asTyped
  }
  const request = await input.createRequest({ text, count: decision.count })
  if (request.kind === 'unwritable') {
    console.warn('[prototypes] request not created: the host could not write the request folder')
    return asTyped
  }
  if (request.kind !== 'ready') {
    return asTyped
  }
  // Why: the same check as desktop; a reply that names no usable request folder sends the text as typed.
  if (!isUsablePrototypeRequestFolder(request.requestId, request.folderPath)) {
    console.warn('[prototypes] request not used: the host named no usable request folder')
    return asTyped
  }
  const message = buildPrototypeRequestMessage({
    text,
    agent: input.agent,
    count: decision.count,
    requestId: request.requestId,
    folderPath: request.folderPath
  })
  return { kind: 'send', wireText: message.sentText, shownText: message.visibleText }
}
