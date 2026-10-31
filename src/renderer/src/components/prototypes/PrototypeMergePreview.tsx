import { Info } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { MergePreviewView } from './prototype-merge-preview-document'
import { PrototypeMergePageSkeleton } from './PrototypeMergeSkeleton'
import { useComposedMergePageUrl } from './use-composed-merge-page-url'

const LABEL_CLASS = 'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'
const VIEW_BUTTON = 'h-[26px] rounded-md px-2.5 text-xs font-medium text-foreground'

/** The merge review's right column: the composed page in a script-less frame, with its "approximation" note. */
export function PrototypeMergePreview({
  name,
  agent,
  html,
  anchor,
  view,
  onView
}: {
  /** "D · preview". */
  name: string
  agent: string
  /** The composed document; null until every direction was read. */
  html: string | null
  /** The section the frame moves to, by its anchor; null leaves it where it is. */
  anchor: string | null
  view: MergePreviewView
  onView: (view: MergePreviewView) => void
}): React.JSX.Element {
  const pageSrc = useComposedMergePageUrl(html, anchor)
  return (
    <div className="flex min-w-[320px] flex-[2_1_380px] flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={LABEL_CLASS}>{name}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={translate('components.prototypes.mergePreviewAbout', 'About the preview')}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <Info aria-hidden="true" className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} showArrow={false}>
            {translate(
              'components.prototypes.mergePreviewApproximation',
              "This preview is an approximation. {{agent}} generates the final result, and it may vary with the agent's ability.",
              { agent }
            )}
          </TooltipContent>
        </Tooltip>
        <span className="flex-1" />
        <div
          role="group"
          aria-label={translate('components.prototypes.viewportGroup', 'Viewport')}
          className="flex rounded-lg border border-border p-0.5"
        >
          <button
            type="button"
            aria-pressed={view === 'desktop'}
            onClick={() => onView('desktop')}
            className={cn(VIEW_BUTTON, view === 'desktop' && 'bg-accent')}
          >
            {translate('components.prototypes.viewportDesktop', 'Desktop view')}
          </button>
          <button
            type="button"
            aria-pressed={view === 'phone'}
            onClick={() => onView('phone')}
            className={cn(VIEW_BUTTON, view === 'phone' && 'bg-accent')}
          >
            {translate('components.prototypes.viewportPhone', 'Phone view')}
          </button>
        </div>
      </div>
      <div className="flex justify-center rounded-lg bg-card p-3">
        {pageSrc === null ? (
          <PrototypeMergePageSkeleton />
        ) : (
          <iframe
            title={name}
            sandbox=""
            src={pageSrc}
            referrerPolicy="no-referrer"
            className={cn(
              'h-[70vh] min-h-[480px] rounded-md border-0',
              view === 'phone' ? 'w-[390px]' : 'w-full'
            )}
          />
        )}
      </div>
    </div>
  )
}
