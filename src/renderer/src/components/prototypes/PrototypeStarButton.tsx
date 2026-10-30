import { Star } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

/** The amber star that picks a direction for merge: a dark round badge over the direction's picture. */
export function PrototypeStarButton({
  letter,
  starred,
  onToggle,
  large = false
}: {
  letter: string
  starred: boolean
  onToggle: () => void
  /** The size on a View all card; the strip item takes the small one. */
  large?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={
        starred
          ? translate('components.prototypes.unstarLabel', 'Unstar {{letter}} for merge', {
              letter
            })
          : translate('components.prototypes.starLabel', 'Star {{letter}} for merge', { letter })
      }
      onClick={onToggle}
      className={cn(
        'absolute flex items-center justify-center rounded-full border border-white/15 bg-black/75',
        large ? 'top-2 right-2 size-8' : 'top-0.5 right-0.5 size-[26px]'
      )}
    >
      <Star
        aria-hidden="true"
        className={cn(
          'size-4',
          starred ? 'fill-status-amber text-status-amber' : 'fill-transparent text-white/80'
        )}
      />
    </button>
  )
}
