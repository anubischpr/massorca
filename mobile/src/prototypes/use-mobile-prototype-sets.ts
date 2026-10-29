import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { listMobilePrototypeSets } from '../session/mobile-prototype-host-rpc'
import { useHostClient } from '../transport/host-client-hooks'
import {
  LOADING_PROTOTYPE_SETS,
  nextMobilePrototypeSetsState,
  type MobilePrototypeSetsState
} from './mobile-prototype-sets-state'

/** The Prototypes screens re-list while one is on screen, so new versions show without a tap. */
const REFRESH_MS = 10_000

// The last listing per host: a screen opened from another starts with what that one read.
const lastListing = new Map<string, MobilePrototypeSetsState>()

/** The host's prototype sets, across chats; refreshed while the screen is focused. */
export function useMobilePrototypeSets(hostId: string): MobilePrototypeSetsState {
  const { client } = useHostClient(hostId)
  const [state, setState] = useState(() => lastListing.get(hostId) ?? LOADING_PROTOTYPE_SETS)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const load = useCallback(async () => {
    if (client === null) {
      return
    }
    const next = nextMobilePrototypeSetsState(
      stateRef.current,
      await listMobilePrototypeSets(client, {})
    )
    lastListing.set(hostId, next)
    setState(next)
  }, [client, hostId])
  useFocusEffect(
    useCallback(() => {
      void load()
      const timer = setInterval(() => void load(), REFRESH_MS)
      return () => clearInterval(timer)
    }, [load])
  )
  return state
}
