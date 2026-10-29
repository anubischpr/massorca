import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreateSessionLaunchResult } from './create-session-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

export type CreateSessionPhase =
  | { kind: 'idle' }
  | { kind: 'creating'; plan: CreateSessionLaunchPlan }

export type CreateSessionLanding = Extract<CreateSessionLaunchResult, { ok: true }>

const IDLE: CreateSessionPhase = { kind: 'idle' }

/**
 * One create at a time. A failure returns to the form with its message; the draft lives in the
 * caller, so nothing here can lose the text.
 */
export function useCreateSessionSubmit(args: {
  launch: (plan: CreateSessionLaunchPlan) => Promise<CreateSessionLaunchResult>
  onLanded: (landing: CreateSessionLanding) => void
}): {
  phase: CreateSessionPhase
  error: string
  submit: (plan: CreateSessionLaunchPlan) => Promise<void>
  clearError: () => void
} {
  const [phase, setPhase] = useState<CreateSessionPhase>(IDLE)
  const [error, setError] = useState('')
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const argsRef = useRef(args)
  argsRef.current = args

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const submit = useCallback(async (plan: CreateSessionLaunchPlan): Promise<void> => {
    if (inFlightRef.current) {
      return
    }
    inFlightRef.current = true
    setError('')
    setPhase({ kind: 'creating', plan })
    try {
      const result = await argsRef.current.launch(plan)
      if (result.ok) {
        // Why: the worktree and chat exist even if the screen is gone, so the phone still opens
        // them; dropping the result would lose the text and invite a duplicate.
        argsRef.current.onLanded(result)
        return
      }
      if (mountedRef.current) {
        setError(result.message)
        setPhase(IDLE)
      }
    } finally {
      inFlightRef.current = false
    }
  }, [])

  const clearError = useCallback(() => setError(''), [])
  return { phase, error, submit, clearError }
}
