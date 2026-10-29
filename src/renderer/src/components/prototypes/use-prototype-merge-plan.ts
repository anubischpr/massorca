import { useEffect, useRef } from 'react'
import {
  parsePrototypeMergePlan,
  type PrototypeMergePlan,
  type PrototypeMergeState
} from '../../../../shared/prototype-merge-plan'
import {
  PROTOTYPE_MERGE_PLAN_FILE_NAME,
  prototypeRequestFolder
} from '../../../../shared/prototype-request-folder'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { readPrototypeSetFileOnHost } from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

/** How often the plan file is read while the suggestion is awaited. */
const PLAN_POLL_MS = 3_000

/** The text of the set's merge-plan.json, or null when it is not there yet (or the host cannot read it). */
export async function readPrototypeMergePlanText(
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'>
): Promise<string | null> {
  try {
    const result = await readPrototypeSetFileOnHost(prototypeTargetForSession(set.sessionId), {
      sessionId: set.sessionId,
      requestId: set.requestId,
      fileName: `${prototypeRequestFolder(set.requestId)}/${PROTOTYPE_MERGE_PLAN_FILE_NAME}`
    })
    return result.ok ? result.html : null
  } catch {
    // An older host or a lost connection reads as "no plan yet".
    return null
  }
}

/** While a merge waits for its plan, reads merge-plan.json until a valid plan arrives. */
export function usePrototypeMergePlan(
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'> | null,
  merge: PrototypeMergeState | null,
  onPlan: (plan: PrototypeMergePlan, text: string) => void
): void {
  const onPlanRef = useRef(onPlan)
  onPlanRef.current = onPlan
  const waitingFor = merge?.phase === 'waiting' ? merge.planId : null
  const sessionId = set?.sessionId
  const requestId = set?.requestId
  useEffect(() => {
    if (waitingFor === null || sessionId === undefined || requestId === undefined) {
      return
    }
    let active = true
    let timer: number | undefined
    const poll = async (): Promise<void> => {
      const text = await readPrototypeMergePlanText({ sessionId, requestId })
      if (!active) {
        return
      }
      const plan = text === null ? null : parsePrototypeMergePlan(text)
      if (plan !== null && text !== null) {
        onPlanRef.current(plan, text)
      }
      timer = window.setTimeout(() => void poll(), PLAN_POLL_MS)
    }
    timer = window.setTimeout(() => void poll(), PLAN_POLL_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [waitingFor, sessionId, requestId])
}
