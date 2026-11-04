import type { ReactNode } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

type CreateChatPageFrameProps = {
  /** Replaces the empty-state heading, for a page that reuses this composer (the Tasks home). */
  heading?: string
  /** Replaces the subheading; null omits it. */
  subheading?: string | null
  /** 'top' sits the heading a fixed share of the window height down, above true center, and lets `below` follow the composer. */
  layout?: 'centered' | 'top'
  /** Centered over the composer's place row, such as the Tasks home's WorkSpaces / Bot Team switch. */
  aboveComposer?: ReactNode
  /** Content under the composer. */
  below?: ReactNode
  /** The composer. */
  children: ReactNode
}

/** The heading, the composer column and anything under it, shared by every page that creates. */
export function CreateChatPageFrame({
  heading,
  subheading,
  layout = 'centered',
  aboveComposer,
  below,
  children
}: CreateChatPageFrameProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto bg-chat-canvas px-6 pb-6 scrollbar-sleek',
        // Why: a list appearing below must not widen the page and nudge the composer sideways.
        layout === 'top' && '[scrollbar-gutter:stable]'
      )}
    >
      <div
        className={
          layout === 'top'
            ? 'flex flex-col items-center gap-2 pb-6 pt-[clamp(3.5rem,20vh,12rem)] text-center'
            : 'flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center'
        }
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          {heading ?? translate('components.createChat.emptyHeading', 'What do you want to build?')}
        </h1>
        {subheading === null ? null : (
          <p className="max-w-md text-sm text-muted-foreground">
            {subheading ??
              translate(
                'components.createChat.emptySubheading',
                'Pick where it runs, the project and the agent, then write the first message to create the session.'
              )}
          </p>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl">
        {aboveComposer ? <div className="mb-3 flex justify-center">{aboveComposer}</div> : null}
        {children}
      </div>
      {below ? <div className="mx-auto mt-8 w-full max-w-3xl">{below}</div> : null}
    </div>
  )
}
