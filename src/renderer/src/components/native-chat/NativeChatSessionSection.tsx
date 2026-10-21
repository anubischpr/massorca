import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  useNativeChatOpenSurfaceRequests,
  type NativeChatOpenSurface
} from './native-chat-open-surface'

/** One summary card: a header with its headline value, a compact preview, and inline expansion. */
export function NativeChatSessionSection({
  title,
  summary,
  compact,
  children,
  openRequest
}: {
  title: string
  /** Headline value beside the title, such as a count or progress. */
  summary?: string
  /** Shown only while collapsed. */
  compact?: React.ReactNode
  /** Shown only while expanded. */
  children: React.ReactNode
  /** Expands the section when the chat asks its surface to open. */
  openRequest?: { sessionId: string; surface: NativeChatOpenSurface }
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  useNativeChatOpenSurfaceRequests(
    openRequest?.sessionId ?? null,
    openRequest?.surface ?? 'context',
    () => setOpen(true)
  )
  return (
    <section className="rounded-xl border border-border bg-card p-1 text-card-foreground shadow-xs">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:outline focus-visible:outline-ring"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
            {summary ? (
              <span className="max-w-32 truncate text-muted-foreground">{summary}</span>
            ) : null}
            <ChevronRight
              aria-hidden
              className={
                open
                  ? 'size-3 shrink-0 rotate-90 transition-transform'
                  : 'size-3 shrink-0 transition-transform'
              }
            />
          </button>
        </CollapsibleTrigger>
        {open || !compact ? null : (
          <div className="space-y-1 px-2 pt-1 pb-2 text-muted-foreground">{compact}</div>
        )}
        <CollapsibleContent animation="height">
          <div className="space-y-2 px-2 pt-1 pb-2">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

/** A labeled value inside an expanded section; the parent supplies the `dl`. */
export function NativeChatSessionField({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}
