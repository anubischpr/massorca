import { createContext, useContext, useEffect, useRef, useState, type ReactElement } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { BotTeamFileHoverPreview } from './BotTeamFileHoverPreview'

/** The team whose folder a file chip's path is relative to; null outside a room. */
export const BotTeamFileChipTeamContext = createContext<string | null>(null)

/**
 * A file chip's hover: a preview of the file read from the team's folder. The chip already shows
 * the path, so outside a room it gets no hover rather than one repeating it.
 */
export function BotTeamFileChipHover({
  path,
  children
}: {
  path: string
  /** One element that takes a ref, such as a span. */
  children: ReactElement
}): React.JSX.Element {
  const teamId = useContext(BotTeamFileChipTeamContext)
  if (!teamId) {
    return children
  }
  return (
    <BotTeamFileHoverCard teamId={teamId} path={path} name={path.slice(path.lastIndexOf('/') + 1)}>
      {children}
    </BotTeamFileHoverCard>
  )
}

/** The hover card that previews a team file over its chip; it stays open while the pointer scrolls a page preview. */
export function BotTeamFileHoverCard({
  teamId,
  path,
  name,
  children
}: {
  teamId: string
  path: string
  name: string
  /** One element that takes a ref, such as a span. */
  children: ReactElement
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [inFrame, setInFrame] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Why: the pointer's return to this document is the only sign it left the frame; outside the card, close.
  useEffect(() => {
    if (!inFrame) {
      return
    }
    const onReturn = (event: PointerEvent): void => {
      setInFrame(false)
      if (!(event.target instanceof Node && contentRef.current?.contains(event.target))) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerover', onReturn, true)
    return () => document.removeEventListener('pointerover', onReturn, true)
  }, [inFrame])

  return (
    <HoverCard openDelay={300} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        ref={contentRef}
        side="top"
        align="start"
        variant="workspace-details"
        onPointerLeave={(event) => {
          // Why: entering the page preview's frame reads as leaving the window, which would close the card.
          // React reports that exit with the window, not null, as the related target.
          if (!(event.relatedTarget instanceof Node) && event.target instanceof HTMLIFrameElement) {
            event.preventDefault()
            setInFrame(true)
          }
        }}
      >
        <BotTeamFileHoverPreview teamId={teamId} path={path} name={name} />
      </HoverCardContent>
    </HoverCard>
  )
}
