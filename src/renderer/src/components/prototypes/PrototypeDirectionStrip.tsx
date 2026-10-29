import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import {
  openDirection,
  toggleStar,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { PrototypeStarButton } from './PrototypeStarButton'
import { PrototypeThumbnail } from './PrototypeThumbnail'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** The directions of a set, the main first and the read-only ones nested under it. */
function orderedDirections(
  directions: readonly PrototypeListedDirection[],
  main: string
): { main: PrototypeListedDirection | undefined; others: PrototypeListedDirection[] } {
  return {
    main: directions.find((direction) => direction.letter === main),
    others: directions.filter((direction) => direction.letter !== main)
  }
}

/** "main", the directions a merged one came from ("A + C"), or "read-only". */
function stripTag(state: PrototypeSetState, letter: string): string {
  if (letter === state.active) {
    return translate('components.prototypes.tagMain', 'main')
  }
  const mergedFrom = state.mergedFrom[letter]
  return mergedFrom === undefined
    ? translate('components.prototypes.tagReadOnly', 'read-only')
    : mergedFrom.join(' + ')
}

function StripItem({
  set,
  state,
  update,
  direction
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
  direction: PrototypeListedDirection
}): React.JSX.Element {
  const { letter } = direction
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => update((current) => openDirection(current, letter))}
        aria-label={translate('components.prototypes.showDirection', 'Show direction {{letter}}', {
          letter
        })}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-md p-1.5 text-left',
          letter === state.view ? 'bg-accent' : 'hover:bg-accent/60'
        )}
      >
        <PrototypeThumbnail set={set} direction={direction} />
        <span className="flex justify-between text-xs">
          <span className="font-semibold">{letter}</span>
          <span className="text-muted-foreground">{stripTag(state, letter)}</span>
        </span>
      </button>
      <PrototypeStarButton
        letter={letter}
        starred={state.starred.includes(letter)}
        onToggle={() => update((current) => toggleStar(current, letter))}
      />
    </div>
  )
}

/** The side strip of a set: "Set of N", the main, and the read-only directions nested under it. */
export function PrototypeDirectionStrip({
  set,
  state,
  update
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
}): React.JSX.Element {
  const { main, others } = orderedDirections(set.directions, state.active)
  return (
    <div
      role="group"
      aria-label={translate('components.prototypes.stripGroup', 'Directions in this set')}
      className="scrollbar-sleek flex w-[132px] shrink-0 flex-col gap-2.5 overflow-y-auto border-r border-border p-2.5"
    >
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {translate('components.prototypes.stripLabel', 'Set of {{count}}', {
          count: set.directions.length
        })}
      </span>
      {main === undefined ? null : (
        <StripItem set={set} state={state} update={update} direction={main} />
      )}
      <div
        role="group"
        aria-label={translate('components.prototypes.readOnlyGroup', 'Read-only directions')}
        className="ml-2 flex flex-col gap-2 border-l border-border pl-2"
      >
        {others.map((direction) => (
          <StripItem
            key={direction.letter}
            set={set}
            state={state}
            update={update}
            direction={direction}
          />
        ))}
      </div>
    </div>
  )
}
