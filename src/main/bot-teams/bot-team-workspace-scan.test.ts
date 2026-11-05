import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listRecentWorkspaceFiles } from './bot-team-workspace-scan'

describe('listRecentWorkspaceFiles', () => {
  let root = ''
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function writeAt(relative: string, mtimeMs = Date.now()): void {
    const file = path.join(root, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, '<p>x</p>')
    utimesSync(file, new Date(mtimeMs), new Date(mtimeMs))
  }

  const sinceTaskBegan = Date.now() - 60 * 1000

  it('skips dependencies, build output and dot entries, and keeps the rest', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-scan-'))
    writeAt('node_modules/pkg/index.js')
    writeAt('dist/app.js')
    writeAt('build/out.txt')
    writeAt('.cache/x.txt')
    writeAt('.env')
    writeAt('docs/keep.html')

    expect(listRecentWorkspaceFiles(root, sinceTaskBegan)).toEqual(['docs/keep.html'])
  })

  it('leaves out names git tracks and names that look like credentials', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-scan-'))
    writeAt('docs/checkout.html')
    writeAt('docs/credentials.json')
    writeAt('docs/server.key')
    writeAt('docs/keep.html')

    expect(listRecentWorkspaceFiles(root, sinceTaskBegan, new Set(['docs/checkout.html']))).toEqual(
      ['docs/keep.html']
    )
  })

  it('leaves out files written before the task began', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-scan-'))
    writeAt('docs/old.html', Date.now() - 2 * 60 * 60 * 1000)
    writeAt('docs/new.html')

    expect(listRecentWorkspaceFiles(root, sinceTaskBegan)).toEqual(['docs/new.html'])
  })

  it('keeps at most the attachment limit, newest first', () => {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-scan-'))
    for (let index = 0; index < 12; index += 1) {
      writeAt(`docs/f${index}.html`, Date.now() - (12 - index) * 1000)
    }

    const picked = listRecentWorkspaceFiles(root, sinceTaskBegan)

    expect(picked).toHaveLength(10)
    expect(picked[0]).toBe('docs/f11.html')
  })
})
