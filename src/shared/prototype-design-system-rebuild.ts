// The sets a design system update can also rebuild, as the message asks for them: each set's title and folder,
// and the version every direction is written at next.
import type { DesignSystemRebuildSet } from './prototype-design-system-message'
import { prototypeTitle } from './prototype-list-model'
import { nextVersionOf } from './prototype-set-view'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

/** The rebuild entries of the sets that have a folder on the host; a set without one cannot be rebuilt. */
export function designSystemRebuildSetsOf(
  sets: readonly PrototypeListedSet[]
): DesignSystemRebuildSet[] {
  return sets.flatMap((set) =>
    set.folderPath === undefined
      ? []
      : [
          {
            title: prototypeTitle(set),
            folderPath: set.folderPath,
            directions: set.directions.map((direction) => ({
              letter: direction.letter,
              nextVersion: nextVersionOf(set.directions, direction.letter)
            }))
          }
        ]
  )
}
