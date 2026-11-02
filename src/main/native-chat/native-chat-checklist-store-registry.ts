import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import { NativeChatChecklistStore } from './native-chat-checklist-store'

let store: { directory: string; store: NativeChatChecklistStore } | null = null

/** The store for the active profile's state directory, the one the chat journals live in. */
export function getNativeChatChecklistStore(): NativeChatChecklistStore {
  const directory = getProfileUserDataPath()
  if (store?.directory !== directory) {
    store = { directory, store: new NativeChatChecklistStore(directory) }
  }
  return store.store
}
