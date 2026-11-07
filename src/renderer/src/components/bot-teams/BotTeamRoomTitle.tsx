import { createPortal } from 'react-dom'
import { usePageTopBandTitleTarget } from '../../app-shell/page-top-band-slot'

/** The room's title sits in the one top bar when there is one, otherwise over the conversation. */
export function BotTeamRoomTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  const target = usePageTopBandTitleTarget()
  return target ? (
    createPortal(
      <div
        data-bot-character-zone=""
        className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm font-medium"
      >
        {children}
      </div>,
      target
    )
  ) : (
    <div
      data-bot-character-zone=""
      className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium"
    >
      {children}
    </div>
  )
}
