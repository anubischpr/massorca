import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MarketplaceHostProgramId,
  MarketplaceHostProgramResult,
  MarketplaceHostProgramStatus
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import {
  readHostProgramStatus,
  runHostProgramAction,
  type HostProgramAction
} from './marketplace-host-program-client'

export type HostProgramFailure = Extract<MarketplaceHostProgramResult, { ok: false }>

export type HostProgramPhase =
  | { kind: 'idle' }
  | { kind: 'running'; action: HostProgramAction }
  | { kind: 'failed'; action: HostProgramAction; failure: HostProgramFailure }

export type MarketplaceHostProgram = {
  program: MarketplaceHostProgramId
  hostKey: string
  /** Null while the host is being asked. */
  status: MarketplaceHostProgramStatus | null
  phase: HostProgramPhase
  /** What the last successful run removed or left, in plain words. */
  notice: string | null
  run: (action: HostProgramAction) => Promise<void>
  dismiss: () => void
}

/**
 * One program on the picked host: its install state, and Install or Uninstall with progress.
 * Why one instance per page: the install and uninstall controls must agree on what the host has.
 */
export function useMarketplaceHostProgram(
  program: MarketplaceHostProgramId | null,
  hostKey: string,
  onChanged?: () => void
): MarketplaceHostProgram | null {
  const [state, setState] = useState<{
    key: string
    status: MarketplaceHostProgramStatus | null
    phase: HostProgramPhase
    notice: string | null
  }>({ key: '', status: null, phase: { kind: 'idle' }, notice: null })
  const key = `${program ?? ''}|${hostKey}`
  const changed = useRef(onChanged)
  changed.current = onChanged

  const load = useCallback(
    async (forKey: string, id: MarketplaceHostProgramId): Promise<void> => {
      const status = await readHostProgramStatus(id, hostKey)
      setState((current) => (current.key === forKey ? { ...current, status } : current))
    },
    [hostKey]
  )

  useEffect(() => {
    if (program === null) {
      return
    }
    // Why reset: a new pick starts from checking, never from the previous host's answer.
    setState({ key, status: null, phase: { kind: 'idle' }, notice: null })
    void load(key, program)
  }, [key, program, load])

  const run = useCallback(
    async (action: HostProgramAction): Promise<void> => {
      if (program === null) {
        return
      }
      setState((current) => ({ ...current, phase: { kind: 'running', action }, notice: null }))
      const result = await runHostProgramAction(action, program, hostKey)
      if (result.ok) {
        setState((current) =>
          current.key === key
            ? { ...current, phase: { kind: 'idle' }, notice: result.message ?? null }
            : current
        )
        await load(key, program)
        changed.current?.()
        return
      }
      setState((current) =>
        current.key === key
          ? { ...current, phase: { kind: 'failed', action, failure: result } }
          : current
      )
      // Why re-read: a failed run can still have changed the host (a partial install).
      await load(key, program)
    },
    [program, hostKey, key, load]
  )

  const dismiss = useCallback(
    () => setState((current) => ({ ...current, phase: { kind: 'idle' }, notice: null })),
    []
  )

  if (program === null) {
    return null
  }
  const current = state.key === key ? state : null
  return {
    program,
    hostKey,
    status: current?.status ?? null,
    phase: current?.phase ?? { kind: 'idle' },
    notice: current?.notice ?? null,
    run,
    dismiss
  }
}
