// The design system's Versions sheet and its earlier-version banner: which rows it lists, what each offers, and the
// restore's labels and confirm text.
import type { DesignSystemVersionListed } from '../../../src/shared/rpc-contract/prototype-params'
import { shortDateTimeLabelOf } from './mobile-prototype-versions-model'

/** `current`: the live system, no button; `viewable`: a saved earlier version, View; `unsaved`: listed from history only. */
export type MobileDesignSystemVersionState = 'current' | 'viewable' | 'unsaved'

export type MobileDesignSystemVersionRow = {
  version: number
  label: string
  /** "Today, 14:05" on the day it was made, else "Oct 28, 21:05"; empty when the host gave no time. */
  timeLabel: string
  state: MobileDesignSystemVersionState
}

/** The versions of a design system, newest first, each with what its row offers. */
export function designSystemVersionRowsOf(
  versions: readonly DesignSystemVersionListed[],
  now: Date = new Date()
): MobileDesignSystemVersionRow[] {
  return [...versions]
    .sort((left, right) => right.version - left.version)
    .map((version) => ({
      version: version.version,
      label: version.current ? `Current · v${version.version}` : `v${version.version}`,
      timeLabel: timeLabelOf(version.at, now),
      state: version.current ? 'current' : version.saved ? 'viewable' : 'unsaved'
    }))
}

/** The newest version listed, which a restore builds on; null when the host lists none. */
export function latestDesignSystemVersionOf(
  versions: readonly DesignSystemVersionListed[]
): number | null {
  return versions.reduce<number | null>(
    (latest, version) => (latest === null || version.version > latest ? version.version : latest),
    null
  )
}

/** The primary button of an earlier version: the number the restored copy gets. */
export function designSystemRestoreLabelOf(latestVersion: number): string {
  return `↺ Restore as v${latestVersion + 1}`
}

/** The question a restore asks first; nothing is removed, so the earlier versions stay listed. */
export function designSystemRestoreConfirmOf(
  version: number,
  latestVersion: number
): { title: string; message: string } {
  return {
    title: `Restore v${version} as v${latestVersion + 1}?`,
    message: `It becomes version ${latestVersion + 1}, the current one, with the content of v${version}. Versions 1 to ${latestVersion} stay in the list.`
  }
}

function timeLabelOf(at: string | undefined, now: Date): string {
  if (at === undefined) {
    return ''
  }
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }
  if (sameDay(date, now)) {
    return `Today, ${clockOf(date)}`
  }
  return shortDateTimeLabelOf(date)
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function clockOf(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
