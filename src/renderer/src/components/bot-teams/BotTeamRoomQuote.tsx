/** The message a sent line answers, quoted at the top of its bubble. */
export function BotTeamRoomQuote({
  authorName,
  color,
  text
}: {
  authorName: string
  color?: string
  text: string
}): React.JSX.Element {
  return (
    <div className="mb-1.5 rounded-md border-l-2 border-border bg-background/60 px-2 py-1 text-xs">
      <p className="font-medium" style={color ? { color } : undefined}>
        {authorName}
      </p>
      <p className="line-clamp-2 break-words text-muted-foreground">{text}</p>
    </div>
  )
}

/** The small corner that points a run's first bubble at its author, as chat apps draw it. */
export function BotTeamRoomBubbleTail(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 10"
      className="absolute -left-[7px] top-[-1px] h-2.5 w-2 fill-card stroke-border"
    >
      <path d="M8.5 0 H0 L8.5 9.5 Z" strokeWidth="0" />
      <path d="M8.5 9.5 L0.5 0.5 H8.5" fill="none" strokeWidth="1" />
    </svg>
  )
}
