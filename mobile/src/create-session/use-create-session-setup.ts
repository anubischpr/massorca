import { useEffect, useMemo, useState } from 'react'
import type { PersistedTrustedOrcaHooks } from '../../../src/shared/orca-yaml-hook-types'
import {
  newWorkspaceSetupHooksRead,
  newWorkspaceUiStateRead
} from '../components/new-workspace-operations'
import type { SetupHookDetails } from '../components/new-worktree-modal-types'
import { normalizeSetupHookTrust } from '../tasks/setup-hook-trust'
import type { RpcClient } from '../transport/rpc-client'
import { resolveCreateSessionSetup, type CreateSessionSetup } from './create-session-readiness'

type Loaded = {
  repoId: string
  /** Null when the hooks could not be read. */
  details: SetupHookDetails | null
}

const NOT_YET: CreateSessionSetup = { decision: 'skip', notice: null }

/**
 * The setup script of the selected project and what a phone tap may do with it. Until the project
 * is read, `ready` is false and Send stays off, so a script can never start unchecked.
 */
export function useCreateSessionSetup(
  client: RpcClient | null,
  repoId: string | null
): { ready: boolean; setup: CreateSessionSetup } {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [trustedHooks, setTrustedHooks] = useState<PersistedTrustedOrcaHooks | null>(null)

  useEffect(() => {
    if (!client) {
      return
    }
    let stale = false
    newWorkspaceUiStateRead
      .request(client)
      .then((reply) => {
        const ui = newWorkspaceUiStateRead.interpret(reply)
        // A refused read trusts nothing.
        if (!stale) {
          setTrustedHooks(ui.accepted ? (ui.value?.trustedOrcaHooks ?? {}) : {})
        }
      })
      .catch(() => {
        if (!stale) {
          setTrustedHooks({})
        }
      })
    return () => {
      stale = true
    }
  }, [client])

  useEffect(() => {
    if (!client || !repoId) {
      return
    }
    let stale = false
    const settle = (details: SetupHookDetails | null): void => {
      if (!stale) {
        setLoaded({ repoId, details })
      }
    }
    newWorkspaceSetupHooksRead
      .request(client, { repo: `id:${repoId}` })
      .then((reply) => {
        const hooks = newWorkspaceSetupHooksRead.interpret(reply)
        if (!hooks.accepted) {
          settle(null)
          return
        }
        settle({
          repoId,
          command: hooks.value.hooks?.scripts?.setup?.trim() || null,
          source: hooks.value.source,
          trust: normalizeSetupHookTrust(hooks.value.setupTrust),
          runPolicy: hooks.value.setupRunPolicy ?? 'run-by-default'
        })
      })
      .catch(() => settle(null))
    return () => {
      stale = true
    }
  }, [client, repoId])

  const ready = repoId !== null && loaded?.repoId === repoId && trustedHooks !== null
  return useMemo(
    () => ({
      ready,
      setup:
        ready && trustedHooks
          ? resolveCreateSessionSetup({ details: loaded?.details ?? null, trustedHooks })
          : NOT_YET
    }),
    [ready, loaded, trustedHooks]
  )
}
