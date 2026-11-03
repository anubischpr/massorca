import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

/** Opens a set the way a chat's prototype link does: one prototype in the viewer, more as a set. */
export function useOpenMobilePrototypeSet(hostId: string): (set: PrototypeListedSet) => void {
  const router = useRouter()
  return useCallback(
    (set: PrototypeListedSet) =>
      router.push({
        pathname: set.count <= 1 ? '/h/[hostId]/prototypes/viewer' : '/h/[hostId]/prototypes/set',
        params: { hostId, request: set.requestId }
      }),
    [hostId, router]
  )
}
