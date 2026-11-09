import { z } from 'zod'
import {
  readGitHubAccountChangeAnswer,
  readGitHubAccountInventoryAnswer,
  type GitHubAccountsHostChange,
  type GitHubAccountsHostList
} from '../../shared/rpc-contract/github-account-binding-params'

const METHOD_NOT_FOUND = -32601
const ConnectionArgs = z.object({ connectionId: z.string().min(1).max(512) })
const LoginArgs = ConnectionArgs.extend({
  host: z.string().min(1).max(253),
  user: z.string().min(1).max(256)
})

/** The part of an SSH relay these calls use; the Marketplace relay's multiplexer satisfies it. */
export type GitHubAccountsRelayMux = {
  isDisposed: () => boolean
  request: (method: string, params?: Record<string, unknown>) => Promise<unknown>
}

export type GitHubAccountsRelayClient = {
  listHostBindableAccounts: (args: unknown) => Promise<GitHubAccountsHostList>
  switchActiveAccount: (args: unknown) => Promise<GitHubAccountsHostChange>
  removeAccount: (args: unknown) => Promise<GitHubAccountsHostChange>
}

type RelayAnswer =
  | { ok: true; answer: unknown }
  | { ok: false; reason: 'host-needs-update' | 'unreachable' | 'failed' }

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

/**
 * Lists and changes the gh logins on an SSH host through that host's own relay, so the logins it
 * changes are the ones its gh uses. Answers are rebuilt from known fields; a failure never repeats
 * any part of the request.
 */
export function createGitHubAccountsRelayClient(
  getMux: (connectionId: string) => GitHubAccountsRelayMux | undefined
): GitHubAccountsRelayClient {
  const send = async (
    connectionId: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<RelayAnswer> => {
    const mux = getMux(connectionId)
    if (!mux || mux.isDisposed()) {
      return { ok: false, reason: 'unreachable' }
    }
    try {
      return { ok: true, answer: await mux.request(method, params) }
    } catch (error) {
      // Why: a relay that predates these methods answers method-not-found; that is the capability gate.
      const code = errorCode(error)
      if (code === METHOD_NOT_FOUND) {
        return { ok: false, reason: 'host-needs-update' }
      }
      return { ok: false, reason: code === 'CONNECTION_LOST' ? 'unreachable' : 'failed' }
    }
  }

  const changeLogin = async (args: unknown, method: string): Promise<GitHubAccountsHostChange> => {
    const parsed = LoginArgs.safeParse(args)
    if (!parsed.success) {
      return { ok: false, reason: 'failed' }
    }
    const { connectionId, host, user } = parsed.data
    const sent = await send(connectionId, method, { host, user })
    return sent.ok ? readGitHubAccountChangeAnswer(sent.answer) : sent
  }

  return {
    listHostBindableAccounts: async (args) => {
      const parsed = ConnectionArgs.safeParse(args)
      if (!parsed.success) {
        return { ok: false, reason: 'failed' }
      }
      const sent = await send(parsed.data.connectionId, 'github.listHostBindableAccounts', {})
      if (!sent.ok) {
        return sent
      }
      const inventory = readGitHubAccountInventoryAnswer(sent.answer)
      return inventory ? { ok: true, inventory } : { ok: false, reason: 'failed' }
    },
    switchActiveAccount: (args) => changeLogin(args, 'github.switchActiveAccount'),
    removeAccount: (args) => changeLogin(args, 'github.removeAccount')
  }
}
