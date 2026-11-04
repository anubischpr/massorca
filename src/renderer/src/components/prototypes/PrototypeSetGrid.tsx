import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import {
  openDirection,
  toggleStar,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { PrototypeStarButton } from './PrototypeStarButton'
import { PrototypeThumbnail } from './PrototypeThumbnail'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** View all: a card per direction. A card only opens its direction; it never changes the main. */
export function PrototypeSetGrid({
  set,
  state,
  update
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek flex flex-1 flex-col gap-4 overflow-y-auto bg-chat-canvas p-6">
      <div className="grid grid-cols-3 gap-5">
        {set.directions.map((direction) => (
          <div key={direction.letter} className="relative flex flex-col gap-2">
            <PrototypeStarButton
              letter={direction.letter}
              starred={state.starred.includes(direction.letter)}
              onToggle={() => update((current) => toggleStar(current, direction.letter))}
              large
            />
            <button
              type="button"
              onClick={() => update((current) => openDirection(current, direction.letter))}
              aria-label={translate(
                'components.prototypes.cardLabel',
                'Open direction {{letter}}',
                {
                  letter: direction.letter
                }
              )}
              className={cn(
                'rounded-lg p-2 transition-shadow',
                direction.letter === state.active &&
                  'ring-2 ring-ring ring-offset-2 ring-offset-background'
              )}
            >
              <PrototypeThumbnail set={set} direction={direction} viewport={state.viewport} />
            </button>
            <span className="flex flex-col">
              <span className="font-semibold">
                {direction.name === undefined
                  ? direction.letter
                  : translate('components.prototypes.cardName', '{{letter}} · {{name}}', {
                      letter: direction.letter,
                      name: direction.name
                    })}
              </span>
              {direction.tradeoff === undefined ? null : (
                <span className="text-xs text-muted-foreground">{direction.tradeoff}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {translate(
          'components.prototypes.setFooter',
          'Open a direction to iterate on it. The others stay one click away in the side strip.'
        )}
      </span>
    </div>
  )
}
