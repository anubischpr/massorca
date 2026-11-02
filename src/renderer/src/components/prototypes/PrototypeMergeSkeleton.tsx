import { cn } from '@/lib/utils'

const PART_ROWS = [0, 1, 2, 3] as const

/** A pulsing block in the muted token; the motion is dropped for reduced-motion users. */
function SkeletonBlock({ className }: { className: string }): React.JSX.Element {
  return <div className={cn('motion-safe:animate-pulse rounded-md bg-muted', className)} />
}

/** The page's box while its composed page is not ready: the size the page fills. */
export function PrototypeMergePageSkeleton(): React.JSX.Element {
  return (
    <div data-testid="prototype-merge-page-skeleton" className="flex w-full justify-center">
      <SkeletonBlock className="h-[70vh] min-h-[480px] w-full" />
    </div>
  )
}

/**
 * The merge review's shape while the agent's plan is generated: the part rows, then the page. Only the
 * shape shows; the progress row above says what is being waited for.
 */
export function PrototypeMergeSkeleton(): React.JSX.Element {
  return (
    <div
      data-testid="prototype-merge-skeleton"
      aria-hidden="true"
      className="scrollbar-sleek flex min-w-0 flex-1 flex-wrap content-start gap-5 overflow-y-auto px-6 py-5"
    >
      <div className="flex max-w-[520px] flex-[1_1_380px] flex-col gap-2">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3 w-64" />
        <div className="flex flex-col gap-1.5 pt-2">
          {PART_ROWS.map((row) => (
            <SkeletonBlock key={row} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-[320px] flex-[2_1_380px] flex-col gap-2">
        <SkeletonBlock className="h-3 w-24" />
        <div className="flex justify-center rounded-lg bg-card p-3">
          <PrototypeMergePageSkeleton />
        </div>
      </div>
    </div>
  )
}
