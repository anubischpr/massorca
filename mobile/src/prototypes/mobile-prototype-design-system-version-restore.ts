// The alert a failed design system version restore shows; the restore itself is the host RPC in the session layer.
import type { MobilePrototypeDesignSystemRestore } from './mobile-prototype-design-system-version-rpc'

/** The alert a failed restore shows; null once it has worked. */
export function designSystemRestoreFailureAlert(
  outcome: MobilePrototypeDesignSystemRestore
): { title: string; message: string } | null {
  switch (outcome.kind) {
    case 'restored':
      return null
    case 'refused':
      return DESIGN_SYSTEM_REFUSAL_ALERTS[outcome.error]
    case 'unsupported-host':
      return {
        title: 'Restore needs a newer Orca',
        message: 'Update Orca on your computer to restore versions.'
      }
    case 'unreachable':
      return { title: 'Could not reach your computer', message: 'Try again in a moment.' }
  }
}

const DESIGN_SYSTEM_REFUSAL_ALERTS = {
  not_found: {
    title: 'Could not restore this version',
    message: 'This version is no longer on your computer.'
  },
  current: {
    title: 'This is already the current version',
    message: 'Nothing was restored.'
  },
  unwritable: {
    title: 'Could not restore this version',
    message: 'Your computer could not save the restored copy.'
  }
} as const
