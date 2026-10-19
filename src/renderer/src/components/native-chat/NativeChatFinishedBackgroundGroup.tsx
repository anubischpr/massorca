import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** Finished background work under its own toggle, collapsed so running work stays the focus. */
export function NativeChatFinishedBackgroundGroup({
  count,
  children
}: {
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1 rounded-md py-1 text-left font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-ring"
        >
          <ChevronRight
            aria-hidden
            className={
              open
                ? 'size-3 shrink-0 rotate-90 transition-transform'
                : 'size-3 shrink-0 transition-transform'
            }
          />
          {t('components.nativeChatBackground.finishedCount', '{{count}} finished', { count })}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent animation="height">
        <ul className="space-y-2 pt-2">{children}</ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
