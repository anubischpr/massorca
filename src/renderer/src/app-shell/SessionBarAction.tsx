import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** One icon action in the session bar; a disabled one explains why in its tooltip. */
export function SessionBarAction({
  label,
  icon,
  disabledReason,
  pending = false,
  pressed,
  onClick
}: {
  label: string
  icon: ReactNode
  pending?: boolean
  pressed?: boolean
  /** Set when the action cannot run; the tooltip then says why. */
  disabledReason?: string
  onClick: () => void
}): React.JSX.Element {
  const disabled = disabledReason !== undefined
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground [&_svg]:size-4"
      aria-label={label}
      aria-busy={pending || undefined}
      aria-pressed={pressed}
      disabled={disabled || pending}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : icon}
    </Button>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Why: a disabled button swallows pointer events, so the focusable wrapper carries the tooltip. */}
        {disabled ? (
          <span tabIndex={0} className="inline-flex">
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {disabled ? (
          <span className="flex flex-col gap-0.5">
            <span>{label}</span>
            <span className="text-muted-foreground">{disabledReason}</span>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  )
}
