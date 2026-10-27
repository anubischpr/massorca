/** How many artifact thumbnails may hold a live WebView at once. Each live WebView is a renderer
 *  process on Android; a long Artifacts list would otherwise keep one per page it ever showed. */
export const MAX_LIVE_ARTIFACT_PREVIEWS = 6

export type ArtifactPreviewSlots = {
  /** Holds a slot for `id`, or refuses when every slot is held by someone else. */
  acquire: (id: string) => boolean
  /** Frees `id`'s slot and wakes the waiting previews. */
  release: (id: string) => void
  /** Called when a slot frees, so a waiting preview can try again. */
  subscribe: (listener: () => void) => () => void
  heldCount: () => number
}

export function createArtifactPreviewSlots(max: number): ArtifactPreviewSlots {
  const holders = new Set<string>()
  const listeners = new Set<() => void>()
  return {
    acquire(id) {
      if (holders.has(id)) {
        return true
      }
      if (holders.size >= max) {
        return false
      }
      holders.add(id)
      return true
    },
    release(id) {
      if (holders.delete(id)) {
        for (const listener of listeners) {
          listener()
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    heldCount: () => holders.size
  }
}

export const artifactPreviewSlots = createArtifactPreviewSlots(MAX_LIVE_ARTIFACT_PREVIEWS)
