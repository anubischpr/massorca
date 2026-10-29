// Which runtime owns a prototype set: the Prototypes view reads each paired runtime as well as this
// machine, and every later read or write of a set goes back to the host that listed it.
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { getRuntimeSessionMirrorEnvironmentIds } from '@/lib/runtime-session-mirror-owners'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import {
  listPrototypeSetsOnHost,
  PrototypeHostOutdatedError
} from '@/runtime/runtime-prototype-client'
import { useAppStore } from '@/store'

const LOCAL_TARGET: RuntimeClientTarget = { kind: 'local' }
const targetBySessionId = new Map<string, RuntimeClientTarget>()

/** This machine first, then every paired runtime the app knows a workspace or session on. */
export function prototypeHostTargets(): RuntimeClientTarget[] {
  const environmentIds = getRuntimeSessionMirrorEnvironmentIds(useAppStore.getState())
  return [
    LOCAL_TARGET,
    ...environmentIds.map((environmentId): RuntimeClientTarget => ({
      kind: 'environment',
      environmentId
    }))
  ]
}

/** The host a listed chat lives on; a chat never listed is on this machine. */
export function prototypeTargetForSession(sessionId: string): RuntimeClientTarget {
  return targetBySessionId.get(sessionId) ?? LOCAL_TARGET
}

function describeTarget(target: RuntimeClientTarget): string {
  return target.kind === 'local' ? 'local' : `runtime ${target.environmentId}`
}

export type PrototypeHostListing = {
  sets: PrototypeListedSet[]
  /** At least one host answered. */
  answered: boolean
  /** Every host that failed was outdated. */
  onlyOutdated: boolean
}

/** Lists every host's sets; a host that fails is logged and left out, never fatal for the others. */
export async function listPrototypeSetsFromAllHosts(): Promise<PrototypeHostListing> {
  const targets = prototypeHostTargets()
  const settled = await Promise.allSettled(
    targets.map((target) => listPrototypeSetsOnHost(target, {}))
  )
  const sets: PrototypeListedSet[] = []
  let answered = false
  let failed = 0
  let outdated = 0
  settled.forEach((outcome, index) => {
    const target = targets[index]
    if (outcome.status === 'fulfilled') {
      answered = true
      for (const set of outcome.value.sets) {
        targetBySessionId.set(set.sessionId, target)
        sets.push(set)
      }
      return
    }
    failed += 1
    const isOutdated = outcome.reason instanceof PrototypeHostOutdatedError
    outdated += isOutdated ? 1 : 0
    console.warn(
      `[prototypes] list failed on ${describeTarget(target)}: ${isOutdated ? 'host does not support prototypes' : String(outcome.reason)}`
    )
  })
  return { sets, answered, onlyOutdated: failed > 0 && failed === outdated }
}
