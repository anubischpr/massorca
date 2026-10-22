import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** Finished background work under its own toggle, collapsed so running work stays the focus. The
 *  owner holds `open`, so it survives the group unmounting while a detail view is shown. */
export function NativeChatFinishedBackgroundGroup({
  count,
  open,
  onOpenChange: setOpen,
  children
}: {
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
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
