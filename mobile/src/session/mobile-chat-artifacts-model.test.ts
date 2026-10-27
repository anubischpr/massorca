import { describe, expect, it } from 'vitest'
import {
  artifactDayLabel,
  filterRecordedFiles,
  groupRecordedFilesByDay,
  recordedFileKind,
  viewerKindOf
} from './mobile-chat-artifacts-model'

const FILES = [
  { path: 'site/index.html', timestamp: null },
  { path: 'docs/README.md', timestamp: null },
  { path: 'src/app.ts', timestamp: null },
  { path: 'img/logo.png', timestamp: null },
  { path: 'art/chart.svg', timestamp: null }
]

describe('recordedFileKind', () => {
  it('treats html, htm, md and svg as pages, everything else as files', () => {
    expect(['a.html', 'b.HTM', 'c.md', 'd.svg'].map(recordedFileKind)).toEqual([
      'page',
      'page',
      'page',
      'page'
    ])
    expect(['src/app.ts', 'img/logo.png', '.env', 'notes'].map(recordedFileKind)).toEqual([
      'file',
      'file',
      'file',
      'file'
    ])
  })
})

describe('filterRecordedFiles', () => {
  it('keeps every file, only pages, or only the other files', () => {
    expect(filterRecordedFiles(FILES, 'all')).toHaveLength(5)
    expect(filterRecordedFiles(FILES, 'pages').map((file) => file.path)).toEqual([
      'site/index.html',
      'docs/README.md',
      'art/chart.svg'
    ])
    expect(filterRecordedFiles(FILES, 'files').map((file) => file.path)).toEqual([
      'src/app.ts',
      'img/logo.png'
    ])
  })
})

describe('viewerKindOf', () => {
  it('picks the viewer and its chip for each kind of file', () => {
    expect(viewerKindOf('index.html')).toEqual({ kind: 'html', label: 'HTML' })
    expect(viewerKindOf('chart.svg')).toEqual({ kind: 'html', label: 'SVG' })
    expect(viewerKindOf('README.md')).toEqual({ kind: 'markdown', label: 'Markdown' })
    expect(viewerKindOf('app.ts')).toEqual({ kind: 'source', label: 'Source' })
  })
})

describe('groupRecordedFilesByDay', () => {
  // Local-time constructors keep these checks independent of the machine's zone.
  const now = new Date(2026, 9, 27, 15).getTime()
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()

  it('groups by local day, newest first, labelled Today and Yesterday', () => {
    const groups = groupRecordedFilesByDay(
      [
        { path: 'old.html', timestamp: at(25, 9) },
        { path: 'today.html', timestamp: at(27, 10) },
        { path: 'yesterday.md', timestamp: at(26, 18) },
        { path: 'today-2.html', timestamp: at(27, 11) }
      ],
      now
    )
    expect(groups.map((group) => [group.label, group.files.map((file) => file.path)])).toEqual([
      ['Today', ['today.html', 'today-2.html']],
      ['Yesterday', ['yesterday.md']],
      [artifactDayLabel(at(25, 9), now), ['old.html']]
    ])
  })

  it('puts untimed files in a trailing Earlier group', () => {
    const groups = groupRecordedFilesByDay(
      [
        { path: 'dated.html', timestamp: at(27, 10) },
        { path: 'untimed.html', timestamp: null }
      ],
      now
    )
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Earlier'])
  })

  it('is one unlabelled group when no file carries a time', () => {
    const groups = groupRecordedFilesByDay(
      [
        { path: 'a.html', timestamp: null },
        { path: 'b.md', timestamp: null }
      ],
      now
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBeNull()
    expect(groups[0]?.files).toHaveLength(2)
  })

  it('is empty for an empty list', () => {
    expect(groupRecordedFilesByDay([], now)).toEqual([])
  })
})
