// The Versions sheet and the earlier-version viewer read a direction's files: which rows it lists, what
// a restore offers, and the header of an earlier version.
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type MobilePrototypeVersionRow = {
  version: number
  fileName: string
  /** The newest version of the direction. */
  current: boolean
  label: string
  /** When the file was last written, on this phone's clock: "Oct 28, 21:05". */
  timeLabel: string
}

/** The versions of one direction, newest first; the newest is the current one. */
export function versionRowsOf(
  direction: PrototypeListedDirection | undefined
): MobilePrototypeVersionRow[] {
  return [...(direction?.versions ?? [])]
    .sort((left, right) => right.version - left.version)
    .map((version, index) => ({
      version: version.version,
      fileName: version.fileName,
      current: index === 0,
      label: index === 0 ? `Current · v${version.version}` : `v${version.version}`,
      timeLabel: timeLabelOf(version.mtime)
    }))
}

/** Restore is offered on a host that knows the method, and never on a Gentle Shell set. */
export function canRestoreVersions(
  set: Pick<PrototypeListedSet, 'agent'>,
  hostMayRestore: boolean
): boolean {
  return hostMayRestore && set.agent !== 'gentle-shell'
}

/** The primary button of an earlier version: the number a restore would give the new current copy. */
export function restoreLabelOf(latestVersion: number): string {
  return `Restore as v${latestVersion + 1}`
}

/** The header of an earlier version opened read-only. */
export function earlierVersionHeader(
  letter: string,
  version: number
): { title: string; subtitle: string } {
  return { title: `${letter} · v${version}`, subtitle: 'Earlier version, read-only' }
}

function timeLabelOf(mtime: number): string {
  const date = new Date(mtime)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
