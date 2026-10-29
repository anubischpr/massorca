import { useEffect, useState } from 'react'
import { listPrototypeSetsFromAllHosts } from './prototype-host-targets'

/** How many sets the host lists, for the sidebar row; read on mount and on focus, not polled. */
export function usePrototypeSetCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const load = (): void => {
      // An outdated or unreachable host adds no count; the row still opens the view.
      void listPrototypeSetsFromAllHosts().then((listed) => {
        if (active && listed.answered) {
          setCount(listed.sets.length)
        }
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
