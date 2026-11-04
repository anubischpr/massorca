import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/** A file's full path on hover, over a file row or chip that shows it shortened. */
export function FilePathTooltip({
  path,
  children
}: {
  path: string
  /** One element that takes a ref, such as a button or span. */
  children: ReactElement
}): React.JSX.Element {
  // The app root's delay; its own provider lets the row and chip render outside that root too.
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {path}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
