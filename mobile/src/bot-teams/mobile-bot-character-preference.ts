import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'massorca.botTeams.characterAnimations'

let enabled = true
let loaded = false
const listeners = new Set<() => void>()

function publish(next: boolean): void {
  enabled = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setBotCharacterAnimations(next: boolean): void {
  publish(next)
  void AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {})
}

/** Team characters move and react; off, a still aura still shows who is working. */
export function useBotCharacterAnimations(): boolean {
  useEffect(() => {
    if (loaded) {
      return
    }
    loaded = true
    void AsyncStorage.getItem(STORAGE_KEY).then(
      (value) => {
        if (value !== null) {
          publish(value !== '0')
        }
      },
      () => {}
    )
  }, [])
  return useSyncExternalStore(subscribe, () => enabled)
}
