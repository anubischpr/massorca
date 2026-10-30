import { useEffect, useRef } from 'react'
import {
  parsePrototypeMergePlan,
  type PrototypeMergePlan,
  type PrototypeMergeState
} from '../../../src/shared/prototype-merge-plan'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'
import { readMobilePrototypeMergePlanText } from './mobile-prototype-merge-flow'

/** How often the plan file is read while the suggestion is awaited. */
const PLAN_POLL_MS = 3_000

/** While a merge waits for its plan, reads merge-plan.json until a valid plan arrives. */
export function useMobilePrototypeMergePlan(
  client: RpcClient | null,
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId'> | null,
  merge: PrototypeMergeState | null | undefined,
  onPlan: (plan: PrototypeMergePlan, text: string) => void
): void {
  const onPlanRef = useRef(onPlan)
  useEffect(() => {
    onPlanRef.current = onPlan
  }, [onPlan])
  const waitingFor = merge?.phase === 'waiting' ? merge.planId : null
  const sessionId = set?.sessionId
  const requestId = set?.requestId
  useEffect(() => {
    if (waitingFor === null || sessionId === undefined || requestId === undefined) {
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async (): Promise<void> => {
      const text = await readMobilePrototypeMergePlanText(client, { sessionId, requestId })
      if (!active) {
        return
      }
      const plan = text === null ? null : parsePrototypeMergePlan(text)
      if (plan !== null && text !== null) {
        onPlanRef.current(plan, text)
      }
      timer = setTimeout(() => void poll(), PLAN_POLL_MS)
    }
    timer = setTimeout(() => void poll(), PLAN_POLL_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [client, waitingFor, sessionId, requestId])
}
