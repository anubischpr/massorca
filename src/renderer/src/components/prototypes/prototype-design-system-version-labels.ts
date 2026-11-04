import { translate } from '@/i18n/i18n'
import type { DesignSystemVersionListed } from '../../../../shared/rpc-contract/prototype-params'

const DAY_MS = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Today with its time, Yesterday, or the date; null when the host recorded no readable time. */
function dayLabelOf(at: string | undefined, now: Date): string | null {
  if (at === undefined) {
    return null
  }
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  if (days === 0) {
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return translate('components.prototypes.designSystem.versionToday', 'Today, {{time}}', { time })
  }
  if (days === 1) {
    return translate('components.prototypes.designSystem.versionYesterday', 'Yesterday')
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * What a version row says under its name: when it was made, and "not saved" for an earlier version the host
 * can list but cannot open. Undefined when there is nothing to say.
 */
export function designSystemVersionMeta(
  version: DesignSystemVersionListed,
  now: Date
): string | undefined {
  const parts: string[] = []
  const when = dayLabelOf(version.at, now)
  if (when !== null) {
    parts.push(when)
  }
  if (!version.saved && !version.current) {
    parts.push(translate('components.prototypes.designSystem.versionNotSaved', 'not saved'))
  }
  return parts.length === 0 ? undefined : parts.join(' · ')
}
