// The two sends of a merge on the set screen: the suggestion request, and "Merge into D".
import {
  buildMergeMessage,
  buildMergeSuggestionMessage
} from '../../../src/shared/prototype-merge-message'
import {
  beginMerge,
  beginMergeSend,
  canMerge,
  mergeRefused,
  mergeRequestRefused,
  mergeSent
} from '../../../src/shared/prototype-merge-state'
import {
  PROTOTYPE_MERGE_PLAN_FILE_NAME,
  prototypeRequestFolder
} from '../../../src/shared/prototype-request-folder'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { readMobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import { sendMobilePrototypeText } from './mobile-prototype-chat-text-send'

export type MobilePrototypeMergeFlow = {
  client: RpcClient | null
  set: PrototypeListedSet
  /** The letter the merged direction takes; null when the set has no free letter. */
  nextLetter: string | null
  getState: () => PrototypeSetState | undefined
  update: (transform: (state: PrototypeSetState) => PrototypeSetState) => void
}

/** The text of the set's merge-plan.json, or null when it is not there yet or the host cannot be read. */
export async function readMobilePrototypeMergePlanText(
  client: RpcClient | null,
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'>
): Promise<string | null> {
  if (client === null) {
    return null
  }
  try {
    const read = await readMobilePrototypeFile(client, {
      sessionId: set.sessionId,
      requestId: set.requestId,
      fileName: `${prototypeRequestFolder(set.requestId)}/${PROTOTYPE_MERGE_PLAN_FILE_NAME}`
    })
    return read.kind === 'ready' ? read.html : null
  } catch {
    return null
  }
}

/** Merge pressed: the chat is asked to suggest a plan, and the set waits for it. */
export async function startMobilePrototypeMerge(flow: MobilePrototypeMergeFlow): Promise<void> {
  const { client, set, nextLetter, getState, update } = flow
  const { folderPath } = set
  const before = getState()
  if (folderPath === undefined || before === undefined || !canMerge(before, nextLetter)) {
    return
  }
  // The plan file as it is now: an answer without an id must differ from it.
  const baseline = await readMobilePrototypeMergePlanText(client, set)
  const latest = getState()
  if (latest === undefined || !canMerge(latest, nextLetter)) {
    return
  }
  const planId = `m${Date.now().toString(36)}`
  update((current) => beginMerge(current, { planId, baseline }))
  const message = buildMergeSuggestionMessage({
    requestId: set.requestId,
    letters: latest.starred,
    planId,
    folderPath
  })
  if (!(await sendMobilePrototypeText(client, set, message.sentText))) {
    update(mergeRequestRefused)
  }
}

/** "Merge into D" from the review: the chat takes it and the set waits for D, or the review stays. */
export async function sendMobilePrototypeMerge(flow: MobilePrototypeMergeFlow): Promise<void> {
  const { client, set, nextLetter, getState, update } = flow
  const { folderPath } = set
  const merge = getState()?.merge
  if (folderPath === undefined || nextLetter === null || merge?.phase !== 'review') {
    return
  }
  update(beginMergeSend)
  const message = buildMergeMessage({
    requestId: set.requestId,
    letters: merge.letters,
    letter: nextLetter,
    parts: merge.parts,
    note: merge.note,
    folderPath
  })
  const sent = await sendMobilePrototypeText(client, set, message.sentText)
  update((latest) =>
    sent
      ? mergeSent(latest, { letter: nextLetter, visibleMessage: message.visibleText })
      : mergeRefused(latest)
  )
}
