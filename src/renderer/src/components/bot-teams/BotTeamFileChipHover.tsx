import { createContext, useContext, type ReactElement } from 'react'
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
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" align="start" variant="workspace-details">
        <BotTeamFileHoverPreview
          teamId={teamId}
          path={path}
          name={path.slice(path.lastIndexOf('/') + 1)}
        />
      </HoverCardContent>
    </HoverCard>
  )
}
