import { translate } from '@/i18n/i18n'
import type { CalendarFrequency } from './calendar-types'

/** Reuses the automation schedule picker's cadence names; Once and Monthly are bot routines only. */
export function calendarFrequencyLabel(frequency: CalendarFrequency): string {
  switch (frequency) {
    case 'once':
      return translate('components.calendar.once', 'Once')
    case 'hourly':
      return translate('auto.components.automations.AutomationSchedulePicker.55b2ef82a4', 'Hourly')
    case 'daily':
      return translate('auto.components.automations.AutomationSchedulePicker.f0202f3a89', 'Daily')
    case 'weekdays':
      return translate(
        'auto.components.automations.AutomationSchedulePicker.57e83307d0',
        'Weekdays'
      )
    case 'weekly':
      return translate('auto.components.automations.AutomationSchedulePicker.837d902bba', 'Weekly')
    case 'monthly':
      return translate('components.calendar.monthly', 'Monthly')
    case 'custom':
      return translate(
        'auto.components.automations.AutomationSchedulePicker.ddba78647e',
        'Custom cron'
      )
  }
}
