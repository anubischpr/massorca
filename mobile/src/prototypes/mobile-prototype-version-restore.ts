// The restore of an earlier version, from the set it belongs to, and the alert each failure shows.
import {
  restoreMobilePrototypeVersion,
  type MobilePrototypeRestore
} from '../session/mobile-prototype-host-rpc'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'

export type MobilePrototypeRestoreOutcome =
  | { kind: 'restored'; version: number }
  | Exclude<MobilePrototypeRestore, { kind: 'restored' }>

/** Restores one earlier version of one direction of the set; nothing is deleted on the host. */
export function restoreMobilePrototypeVersionOf(
  client: Pick<RpcClient, 'sendRequest'>,
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'>,
  letter: string,
  version: number
): Promise<MobilePrototypeRestoreOutcome> {
  return restoreMobilePrototypeVersion(client, {
    sessionId: set.sessionId,
    requestId: set.requestId,
    letter,
    version
  }).then((result) =>
    result.kind === 'restored' ? { kind: 'restored', version: result.version } : result
  )
}

/** The alert a failed restore shows; null once it has worked. */
export function restoreFailureAlert(
  outcome: MobilePrototypeRestoreOutcome
): { title: string; message: string } | null {
  switch (outcome.kind) {
    case 'restored':
      return null
    case 'refused':
      return RESTORE_REFUSAL_ALERTS[outcome.error]
    case 'unsupported-host':
      return {
        title: 'Restore needs a newer Orca',
        message: 'Update Orca on your computer to restore versions.'
      }
    case 'unreachable':
      return { title: 'Could not reach your computer', message: 'Try again in a moment.' }
  }
}

const RESTORE_REFUSAL_ALERTS = {
  not_found: {
    title: 'Could not restore this version',
    message: 'This version is no longer on your computer.'
  },
  conflict: {
    title: 'Could not restore this version',
    message: 'Another version was saved first. Try again.'
  },
  unwritable: {
    title: 'Could not restore this version',
    message: 'Your computer could not save the restored copy.'
  }
} as const
