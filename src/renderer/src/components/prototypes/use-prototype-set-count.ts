import { useEffect, useState } from 'react'
import { listPrototypeSetsOnHost } from '../../runtime/runtime-prototype-client'

const LOCAL_RUNTIME = { kind: 'local' } as const

/** How many sets the host lists, for the sidebar row; read on mount and on focus, not polled. */
export function usePrototypeSetCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const load = (): void => {
      void listPrototypeSetsOnHost(LOCAL_RUNTIME, {})
        .then((listed) => {
          if (active) {
            setCount(listed.sets.length)
          }
        })
        .catch(() => {
          // An outdated or unreachable host shows no count; the row still opens the view.
        })
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
    }
  }, [])
  return count
}
