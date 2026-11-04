import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileFileTypeIcon } from './MobileFileTypeIcon'

vi.mock('lucide-react-native', () => ({
  Database: 'Database',
  File: 'File',
  FileArchive: 'FileArchive',
  FileAxis3d: 'FileAxis3D',
  FileBox: 'FileBox',
  FileBraces: 'FileBraces',
  FileChartColumn: 'FileChartColumn',
  FileCode: 'FileCode',
  FileCog: 'FileCog',
  FileDiff: 'FileDiff',
  FileImage: 'FileImage',
  FileJson: 'FileJson',
  FileKey: 'FileKey',
  FileLock: 'FileLock',
  FileMusic: 'FileMusic',
  FileSliders: 'FileSliders',
  FileSpreadsheet: 'FileSpreadsheet',
  FileTerminal: 'FileTerminal',
  FileText: 'FileText',
  FileType: 'FileType',
  FileVideo: 'FileVideo',
  Smartphone: 'Smartphone'
}))

/** The glyph a file's type draws, by the icon's host type. */
function renderIcon(props: { path: string | null; size?: number; color?: string }) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileFileTypeIcon, props))
  })
  const json = renderer.toJSON()
  return json && !Array.isArray(json) ? json : null
}

function glyphFor(path: string | null): unknown {
  return renderIcon({ path })?.type ?? null
}

describe('MobileFileTypeIcon', () => {
  it('draws the icon of the file type, as the desktop does', () => {
    expect(glyphFor('site/flyer.html')).toBe('FileCode')
    expect(glyphFor('brief.md')).toBe('FileText')
  })

  it('draws the plain file glyph for a path with no known type', () => {
    expect(glyphFor(null)).toBe('File')
  })

  it('passes its size and color to the glyph', () => {
    expect(renderIcon({ path: 'a.json', size: 12, color: '#123456' })?.props).toMatchObject({
      size: 12,
      color: '#123456'
    })
  })
})
