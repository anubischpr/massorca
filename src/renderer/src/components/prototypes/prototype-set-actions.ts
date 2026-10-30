// Archive, unarchive and delete of one prototype set, sent to the host that listed it.
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import {
  archivePrototypeRequestOnHost,
  deletePrototypeRequestOnHost,
  PrototypeHostOutdatedError,
  unarchivePrototypeRequestOnHost
} from '@/runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

/** `unsupported`: the host predates the action, so the client stops offering it for that host. */
export type PrototypeSetActionOutcome = 'done' | 'unsupported' | 'refused' | 'failed'

export type PrototypeSetAction = 'archive' | 'unarchive' | 'delete'

/** One key per host, so an outdated host hides the actions for its sets alone. */
export function prototypeHostKey(target: RuntimeClientTarget): string {
  return target.kind === 'local' ? 'local' : `environment:${target.environmentId}`
}

export async function runPrototypeSetAction(
  action: PrototypeSetAction,
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'>
): Promise<PrototypeSetActionOutcome> {
  const params = { sessionId: set.sessionId, requestId: set.requestId }
  const target = prototypeTargetForSession(set.sessionId)
  try {
    const result =
      action === 'archive'
        ? await archivePrototypeRequestOnHost(target, params)
        : action === 'unarchive'
          ? await unarchivePrototypeRequestOnHost(target, params)
          : await deletePrototypeRequestOnHost(target, params)
    return result.ok ? 'done' : 'refused'
  } catch (error) {
    return error instanceof PrototypeHostOutdatedError ? 'unsupported' : 'failed'
  }
}
