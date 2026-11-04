import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const two = (value: number): string => String(value).padStart(2, '0')

/** A day as `YYYY-MM-DD`, the form a date input reads. */
export function datePickerValue(year: number, month: number, day: number): string {
  return `${year}-${two(month + 1)}-${two(day)}`
}

function parseValue(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match
    ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
    : null
}

/** The month's days, weeks starting on Sunday; null fills the cells before the 1st. */
export function datePickerMonthCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1)
  ]
}

function weekdayNames(locale: string | undefined): string[] {
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 10, 1 + index).toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)
  )
}

/** A date field: an outline button that opens a month grid in a popover. Days before `min` are off. */
export function DatePicker({
  value,
  onChange,
  min,
  today,
  locale,
  'aria-label': ariaLabel
}: {
  value: string
  onChange: (value: string) => void
  /** `YYYY-MM-DD`; earlier days are dimmed and cannot be picked. */
  min?: string
  /** `YYYY-MM-DD` drawn with the ring border. */
  today: string
  locale?: string
  'aria-label': string
}): React.JSX.Element {
  const picked = parseValue(value)
  const start = picked ?? parseValue(today) ?? { year: 2026, month: 0, day: 1 }
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState({ year: start.year, month: start.month })
  const move = (by: number): void => {
    const next = new Date(shown.year, shown.month + by, 1)
    setShown({ year: next.getFullYear(), month: next.getMonth() })
  }
  const label = picked
    ? new Date(picked.year, picked.month, picked.day).toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : ''
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setShown({ year: start.year, month: start.month })
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={ariaLabel}>
          <CalendarDays className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="flex items-center justify-between pb-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="text-[13px] font-semibold">
            {new Date(shown.year, shown.month, 1).toLocaleDateString(locale, {
              month: 'long',
              year: 'numeric'
            })}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <div role="grid" className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {weekdayNames(locale).map((name) => (
            <span key={name} className="h-6 leading-6 text-muted-foreground">
              {name}
            </span>
          ))}
          {datePickerMonthCells(shown.year, shown.month).map((day, index) => {
            if (day === null) {
              return <span key={`lead-${index}`} />
            }
            const cell = datePickerValue(shown.year, shown.month, day)
            const chosen = cell === value
            return (
              <Button
                key={cell}
                variant={chosen ? 'default' : 'ghost'}
                size="icon-sm"
                className="text-xs font-normal data-[today=true]:border data-[today=true]:border-ring aria-pressed:font-semibold"
                data-today={cell === today}
                aria-pressed={chosen}
                aria-current={cell === today ? 'date' : undefined}
                disabled={min !== undefined && cell < min}
                onClick={() => {
                  onChange(cell)
                  setOpen(false)
                }}
              >
                {day}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
