import { describe, expect, it } from 'vitest'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'
import { boundDesignFolderOf, isBoundDesignFile } from './prototype-design-folders'

function setFor(
  agent: PrototypeListedSet['agent'],
  fileName: string | undefined
): PrototypeListedSet {
  return {
    requestId: '20261028-201500-aaaaaa',
    sessionId: 'session-alpha-0001',
    agent,
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'a dashboard',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 2,
    directions:
      fileName === undefined
        ? []
        : [{ letter: 'A', versions: [{ version: 1, fileName, mtime: 1 }] }]
  }
}

describe('boundDesignFolderOf', () => {
  it('gives the design/<slug> folder of a Gentle Shell set', () => {
    expect(boundDesignFolderOf(setFor('gentle-shell', 'design/bold/screens/home.html'))).toBe(
      'design/bold'
    )
  })

  it('gives nothing for a set that is not Gentle Shell, or has no file', () => {
    expect(
      boundDesignFolderOf(setFor('claude', 'prototypes/20261028-201500-aaaaaa/A.html'))
    ).toBeNull()
    expect(boundDesignFolderOf(setFor('gentle-shell', undefined))).toBeNull()
  })
})

describe('isBoundDesignFile', () => {
  it('matches the files under a bound design folder, relative or absolute, in either separator', () => {
    const folders = ['design/bold']

    expect(isBoundDesignFile('design/bold/home.html', folders)).toBe(true)
    expect(isBoundDesignFile('./design/bold/screens/home.html', folders)).toBe(true)
    expect(isBoundDesignFile('C:\\projects\\app\\design\\bold\\home.html', folders)).toBe(true)
    expect(isBoundDesignFile('/home/me/app/design/bold/home.html', folders)).toBe(true)
  })

  it('keeps a file of another design folder, a look-alike folder, or any file when nothing is bound', () => {
    expect(isBoundDesignFile('design/other/home.html', ['design/bold'])).toBe(false)
    expect(isBoundDesignFile('design/boldness/home.html', ['design/bold'])).toBe(false)
    expect(isBoundDesignFile('docs/design/bold-notes.md', ['design/bold'])).toBe(false)
    expect(isBoundDesignFile('design/bold/home.html', [])).toBe(false)
  })
})
