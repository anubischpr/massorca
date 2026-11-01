import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** An icon toggle for the top bar: the session bar's panel buttons and a page's own panel button. */
export function BarToggle({
  label,
  tooltip,
  pressed,
  disabled = false,
  onClick,
  children
}: {
  label: string
  tooltip: string
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          data-active={pressed}
          disabled={disabled}
          className="text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground [&_svg]:size-4"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
