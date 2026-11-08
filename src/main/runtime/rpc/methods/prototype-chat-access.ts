// Which chats' prototype folders a caller may reach on this host, shared by every `prototypes.*` method.

import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { PrototypeListedChat } from '../../../../shared/rpc-contract/prototype-params'
import { prototypeAgentOfChild } from '../../../delegated-session/delegated-child-first-prompt'
import type { RpcContext } from '../core'
import type { requireInstalledStructuredHost } from './structured-agent-session-gate'

export type InstalledHost = Awaited<ReturnType<typeof requireInstalledStructuredHost>>

/** The local chats this host keeps, newest first, as the list names them; a Pi chat lists as 'other'. */
export function listedHostChatsOf(
  records: readonly Pick<AgentSessionRecord, 'sessionId' | 'location' | 'provider' | 'updatedAt'>[]
): PrototypeListedChat[] {
  return records
    .filter(isLocalStructuredChat)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((record) => ({
      sessionId: record.sessionId,
      agent: prototypeAgentOfChild(record.provider)
    }))
}

/** Structured chats run on their owning runtime's own filesystem; any other location has no folder here. */
export function isLocalStructuredChat(record: Pick<AgentSessionRecord, 'location'>): boolean {
  return record.location.executionHostId === LOCAL_EXECUTION_HOST_ID && !record.location.wslDistro
}

/**
 * Whether a caller other than this desktop and its CLI may see a request: one of a local chat the host keeps, or
 * one whose chat record is gone but that was archived, so the phone's Archived group can reach it to delete it.
 * Why archived only: a gone chat's sets stay out of the phone's normal list and of anything it never listed; an
 * archive is a choice made on a client that could list the set, and it grants no read of the set's files.
 */
export function isRequestVisibleToGuest(
  record: Pick<AgentSessionRecord, 'location'> | null | undefined,
  archived: boolean
): boolean {
  return record ? isLocalStructuredChat(record) : archived
}

/** This desktop and its CLI, the owner, see every folder on the host; any other caller, one naming no identity included, is a guest. */
export function isOwnerCaller(ctx: RpcContext): boolean {
  return ctx.caller?.kind === 'desktop' || ctx.caller?.kind === 'local-cli'
}

/** One line for a refusal the client reads as "no prototype capture", so a silent send is traceable. */
export function logPrototypeRefusal(method: string, sessionId: string, reason: string): void {
  console.warn(`[prototypes] ${method} refused for chat ${sessionId}: ${reason}`)
}
