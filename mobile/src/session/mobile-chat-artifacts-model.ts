import {
  boundDesignFolderOf,
  isBoundDesignFile
} from '../../../src/shared/prototype-design-folders'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

/** The two kinds the Artifacts screen separates: pages a viewer can render, and every other file. */
export type MobileRecordedFileKind = 'page' | 'file'

export type MobileRecordedFilterId = 'all' | 'pages' | 'files'

/** What the viewer opens: a file the chat's agent wrote, or a visual its replies showed. */
export type MobileArtifactTarget =
  | { kind: 'recorded'; path: string }
  | { kind: 'visual'; file: string }

/** A page on the Artifacts list: its target, its name and kind, and when the chat last touched it. */
export type MobileArtifactPage = {
  target: MobileArtifactTarget
  name: string
  kind: MobileViewerKind
  label: string
  timestamp: number | null
}

/** How the viewer shows a file: a rendered page, a rendered Markdown document, or its source. */
export type MobileViewerKind = 'html' | 'markdown' | 'source'

const PAGE_EXTENSIONS = new Set(['html', 'htm', 'md', 'svg'])

/** The last path segment, read across both separators. */
export function fileNameOf(path: string): string {
  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? path
}

function extensionOf(path: string): string {
  const name = fileNameOf(path)
  const dot = name.lastIndexOf('.')
  // A leading dot is a dotfile, not an extension.
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** `.html`, `.htm`, `.md` and `.svg` are pages; anything else is a file. */
export function recordedFileKind(path: string): MobileRecordedFileKind {
  return PAGE_EXTENSIONS.has(extensionOf(path)) ? 'page' : 'file'
}

/** The viewer that fits a file, and the chip that names it. SVG renders as a page, its markup
 *  drawn the way an HTML page would draw it. */
export function viewerKindOf(path: string): { kind: MobileViewerKind; label: string } {
  switch (extensionOf(path)) {
    case 'html':
    case 'htm':
      return { kind: 'html', label: 'HTML' }
    case 'svg':
      return { kind: 'html', label: 'SVG' }
    case 'md':
      return { kind: 'markdown', label: 'Markdown' }
    default:
      return { kind: 'source', label: 'Source' }
  }
}

/** The chip words for each filter. */
export function artifactFilterLabel(filter: MobileRecordedFilterId): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'pages':
      return 'Pages'
    case 'files':
      return 'Files'
  }
}

export function filterRecordedFiles<File extends { path: string }>(
  files: readonly File[],
  filter: MobileRecordedFilterId
): File[] {
  if (filter === 'all') {
    return [...files]
  }
  const kind: MobileRecordedFileKind = filter === 'pages' ? 'page' : 'file'
  return files.filter((file) => recordedFileKind(file.path) === kind)
}

export type MobileArtifactGroup<File> = {
  /** Local day as `YYYY-MM-DD`, or `undated` for files the transcript gave no time for. */
  key: string
  /** Null when the list is one undifferentiated group. */
  label: string | null
  files: File[]
}

const UNDATED_KEY = 'undated'

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** `Today`, `Yesterday`, or a short date for anything older, read against `now`. */
export function artifactDayLabel(timestamp: number, now: number): string {
  const day = localDayKey(timestamp)
  if (day === localDayKey(now)) {
    return 'Today'
  }
  if (day === localDayKey(now - 24 * 60 * 60 * 1000)) {
    return 'Yesterday'
  }
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/** Files grouped by the local day of their latest write, newest day first. Files the transcript gave
 *  no time for trail in one group. With no times at all, the list is one group with no label. */
export function groupRecordedFilesByDay<File extends { timestamp: number | null }>(
  files: readonly File[],
  now: number
): MobileArtifactGroup<File>[] {
  if (files.every((file) => file.timestamp === null)) {
    return files.length === 0 ? [] : [{ key: 'all', label: null, files: [...files] }]
  }
  const byDay = new Map<string, MobileArtifactGroup<File>>()
  const undated: File[] = []
  for (const file of files) {
    if (file.timestamp === null) {
      undated.push(file)
      continue
    }
    const key = localDayKey(file.timestamp)
    const group = byDay.get(key) ?? {
      key,
      label: artifactDayLabel(file.timestamp, now),
      files: []
    }
    group.files.push(file)
    byDay.set(key, group)
  }
  const groups = [...byDay.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
  if (undated.length > 0) {
    groups.push({ key: UNDATED_KEY, label: 'Earlier', files: undated })
  }
  return groups
}

/** The name a target shows: the file name, read the same for recorded paths and visual files. */
export function artifactTargetName(target: MobileArtifactTarget): string {
  return fileNameOf(target.kind === 'recorded' ? target.path : target.file)
}

/** The Gentle Shell design folders the prototype sets are bound to; a set of any other agent has none. */
export function boundDesignFoldersOf(sets: readonly PrototypeListedSet[]): string[] {
  return sets.flatMap((set) => {
    const folder = boundDesignFolderOf(set)
    return folder === null ? [] : [folder]
  })
}

/** Leaves out the items under a bound design folder: the Prototypes view owns those files. */
export function withoutBoundDesignFiles<Item>(
  items: readonly Item[],
  pathOf: (item: Item) => string,
  folders: readonly string[]
): Item[] {
  return items.filter((item) => !isBoundDesignFile(pathOf(item), folders))
}

/**
 * The Pages the list shows: recorded pages and the visuals the replies showed. A recorded page whose
 * file name a visual already carries is that visual, so the chat shows it once.
 */
export function chatArtifactPages(
  files: readonly { path: string; timestamp: number | null }[],
  visuals: readonly { file: string; timestamp: number | null }[]
): MobileArtifactPage[] {
  const visualNames = new Set(visuals.map((visual) => visual.file))
  const pages: MobileArtifactPage[] = []
  for (const visual of visuals) {
    pages.push(pageOf({ kind: 'visual', file: visual.file }, visual.timestamp))
  }
  for (const file of files) {
    if (recordedFileKind(file.path) !== 'page' || visualNames.has(fileNameOf(file.path))) {
      continue
    }
    pages.push(pageOf({ kind: 'recorded', path: file.path }, file.timestamp))
  }
  return pages
}

function pageOf(target: MobileArtifactTarget, timestamp: number | null): MobileArtifactPage {
  // A visual is always an HTML page; a recorded file names its own viewer.
  const viewer = viewerKindOf(target.kind === 'recorded' ? target.path : target.file)
  return {
    target,
    name: artifactTargetName(target),
    kind: viewer.kind,
    label: viewer.label,
    timestamp
  }
}
