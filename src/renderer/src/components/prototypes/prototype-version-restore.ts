// Restores one earlier version of a direction on the host that lists its set.
import {
  PrototypeHostOutdatedError,
  restorePrototypeVersionOnHost
} from '@/runtime/runtime-prototype-client'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { prototypeTargetForSession } from './prototype-host-targets'

/**
 * `restored` carries the version the host wrote; `unsupported` means the host predates restoring; `failed`
 * covers a refusal and any other error, so the dialog can stay open for another try.
 */
export type PrototypeVersionRestoreOutcome =
  | { kind: 'restored'; version: number }
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export async function restorePrototypeVersionAction(
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'>,
  letter: string,
  version: number
): Promise<PrototypeVersionRestoreOutcome> {
  try {
    const result = await restorePrototypeVersionOnHost(prototypeTargetForSession(set.sessionId), {
      sessionId: set.sessionId,
      requestId: set.requestId,
      letter,
      version
    })
    return result.ok ? { kind: 'restored', version: result.version } : { kind: 'failed' }
  } catch (error) {
    return error instanceof PrototypeHostOutdatedError
      ? { kind: 'unsupported' }
      : { kind: 'failed' }
  }
}
