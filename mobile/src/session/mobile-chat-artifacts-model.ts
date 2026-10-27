/** The two kinds the Artifacts screen separates: pages a viewer can render, and every other file. */
export type MobileRecordedFileKind = 'page' | 'file'

export type MobileRecordedFilterId = 'all' | 'pages' | 'files'

const PAGE_EXTENSIONS = new Set(['html', 'htm', 'md', 'svg'])

function extensionOf(path: string): string {
  const name = fileNameOf(path)
  const dot = name.lastIndexOf('.')
  // A leading dot is a dotfile, not an extension.
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** The last path segment, read across both separators. */
export function fileNameOf(path: string): string {
  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? path
}

/** `.html`, `.htm`, `.md` and `.svg` are pages; anything else is a file. */
export function recordedFileKind(path: string): MobileRecordedFileKind {
  return PAGE_EXTENSIONS.has(extensionOf(path)) ? 'page' : 'file'
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
