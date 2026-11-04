// Restores one saved version of a design system on the host that answers its chat.
import { restoreDesignSystemVersionOnHost } from '@/runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

/** `restored` carries the new current version the host wrote; `failed` covers a refusal and any other error. */
export type DesignSystemVersionRestoreOutcome =
  | { kind: 'restored'; version: number }
  | { kind: 'failed' }

export async function restoreDesignSystemVersionAction(
  sessionId: string,
  version: number
): Promise<DesignSystemVersionRestoreOutcome> {
  try {
    const result = await restoreDesignSystemVersionOnHost(prototypeTargetForSession(sessionId), {
      sessionId,
      version
    })
    return result.ok ? { kind: 'restored', version: result.version } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
