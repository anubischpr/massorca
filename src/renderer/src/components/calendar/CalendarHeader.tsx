import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { ViewOption } from '../create-chat/CreateChatSessionViewSwitch'
import type { CalendarView } from './calendar-types'

function NavButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Previous, Today, Next, the range title and the Day/Week/Month switch. */
export function CalendarHeader({
  title,
  view,
  onViewChange,
  onPrevious,
  onToday,
  onNext
}: {
  title: string
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  onPrevious: () => void
  onToday: () => void
  onNext: () => void
}): React.JSX.Element {
  const views: [CalendarView, string][] = [
    ['day', translate('components.calendar.day', 'Day')],
    ['week', translate('components.calendar.week', 'Week')],
    ['month', translate('components.calendar.month', 'Month')]
  ]
  return (
    <div className="flex items-center gap-2">
      <NavButton label={translate('components.calendar.previous', 'Previous')} onClick={onPrevious}>
        <ChevronLeft />
      </NavButton>
      <Button type="button" variant="outline" size="xs" onClick={onToday}>
        {translate('components.calendar.today', 'Today')}
      </Button>
      <NavButton label={translate('components.calendar.next', 'Next')} onClick={onNext}>
        <ChevronRight />
      </NavButton>
      <h2 className="ml-2 min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
      <div
        role="radiogroup"
        aria-label={translate('components.calendar.viewAria', 'Calendar view')}
        className="flex shrink-0 gap-0.5 rounded-md bg-muted p-0.5"
      >
        {views.map(([value, label]) => (
          <ViewOption
            key={value}
            label={label}
            checked={view === value}
            onSelect={() => onViewChange(value)}
          />
        ))}
      </div>
    </div>
  )
}
