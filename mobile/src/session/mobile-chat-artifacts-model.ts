/** The two kinds the Artifacts screen separates: pages a viewer can render, and every other file. */
export type MobileRecordedFileKind = 'page' | 'file'

export type MobileRecordedFilterId = 'all' | 'pages' | 'files'

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
