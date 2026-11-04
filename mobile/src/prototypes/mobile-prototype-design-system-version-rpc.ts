// The Versions of a design system on the host: list them and restore one as the new current version. Transport loss
// is never a verdict; an older host answers `method_not_found`, which is `unsupported-host`.
import {
  ListDesignSystemVersionsReplySchema,
  PROTOTYPE_RESTORE_DESIGN_SYSTEM_VERSION_ERRORS,
  RestoreDesignSystemVersionReplySchema,
  type DesignSystemVersionListed,
  type ListDesignSystemVersionsParams,
  type RestoreDesignSystemVersionParams
} from '../../../src/shared/rpc-contract/prototype-params'
import {
  isUnsupportedHost,
  sendHostRequest,
  type HostClient
} from '../session/mobile-prototype-host-rpc'

export type MobilePrototypeDesignSystemVersions =
  | { kind: 'ready'; versions: DesignSystemVersionListed[] }
  /** The host has no such local chat, so it lists no versions for it. */
  | { kind: 'refused' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

/** The versions of one chat's design system, newest first; an older host lacks the method. */
export async function listMobilePrototypeDesignSystemVersions(
  client: HostClient,
  params: ListDesignSystemVersionsParams
): Promise<MobilePrototypeDesignSystemVersions> {
  const response = await sendHostRequest(client, 'prototypes.listDesignSystemVersions', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = ListDesignSystemVersionsReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok ? { kind: 'ready', versions: reply.data.versions } : { kind: 'refused' }
}

export type MobilePrototypeDesignSystemRestore =
  /** The host wrote the restored copy as the new current version. */
  | { kind: 'restored'; version: number }
  | { kind: 'refused'; error: (typeof PROTOTYPE_RESTORE_DESIGN_SYSTEM_VERSION_ERRORS)[number] }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

/** Copies one earlier version of a design system into a new current version; nothing is removed. */
export async function restoreMobilePrototypeDesignSystemVersion(
  client: HostClient,
  params: RestoreDesignSystemVersionParams
): Promise<MobilePrototypeDesignSystemRestore> {
  const response = await sendHostRequest(client, 'prototypes.restoreDesignSystemVersion', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = RestoreDesignSystemVersionReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'restored', version: reply.data.version }
    : { kind: 'refused', error: reply.data.error }
}
