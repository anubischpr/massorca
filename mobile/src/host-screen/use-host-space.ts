import { useCallback, useEffect, useRef, useState } from 'react'
import { loadHostSpace, saveHostSpace, type MobileHostSpace } from '../storage/preferences'

/**
 * The space a host opens into: the one the user last chose, on every launch and visit, and Bot
 * teams until one is stored. `space` stays null until that answer is in, so the screen waits
 * rather than showing Bot teams and then switching.
 */
export function useHostSpace(): {
  space: MobileHostSpace | null
  chooseSpace: (space: MobileHostSpace) => void
} {
  const [space, setSpace] = useState<MobileHostSpace | null>(null)
  // Why: a choice made before the stored one loads must not be overwritten by that load.
  const chosenRef = useRef(false)

  useEffect(() => {
    let active = true
    void loadHostSpace().then((stored) => {
      if (active && !chosenRef.current) {
        setSpace(stored ?? 'teams')
      }
    })
    return () => {
      active = false
    }
  }, [])

  const chooseSpace = useCallback((next: MobileHostSpace) => {
    chosenRef.current = true
    setSpace(next)
    // Why: a failed write only means the choice is not remembered at the next launch.
    void saveHostSpace(next).catch(() => undefined)
  }, [])

  return { space, chooseSpace }
}
