import { describe, expect, it } from 'vitest'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { boundDesignFoldersOf, withoutBoundDesignFiles } from './mobile-chat-artifacts-model'

function setWithFile(
  fileName: string,
  agent: PrototypeListedSet['agent'] = 'gentle-shell'
): PrototypeListedSet {
  return {
    requestId: 'request-1',
    sessionId: 'session-1',
    agent,
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Make a checkout',
    createdAt: '2026-10-29T00:00:00.000Z',
    count: 1,
    directions: [{ letter: 'A', versions: [{ version: 1, fileName, mtime: 1 }] }]
  }
}

describe('the Artifacts list leaves out the design folders its prototype sets own', () => {
  it('names the design folder of a Gentle Shell set and no folder for any other agent', () => {
    expect(
      boundDesignFoldersOf([
        setWithFile('design/shell-a/design.json'),
        setWithFile('prototypes/request-1/A.html', 'codex'),
        setWithFile('notes/A.html')
      ])
    ).toEqual(['design/shell-a'])
  })

  it('removes the files under a bound folder, in either path separator', () => {
    const folders = ['design/shell-a']
    const kept = withoutBoundDesignFiles(
      [
        '/repo/design/shell-a/design.json',
        'D:\\repo\\design\\shell-a\\index.html',
        'design/shell-a/notes.md',
        '/repo/design/shell-b/design.json',
        '/repo/mydesign/shell-a/x.html',
        '/repo/notes.md'
      ],
      (path) => path,
      folders
    )
    expect(kept).toEqual([
      '/repo/design/shell-b/design.json',
      '/repo/mydesign/shell-a/x.html',
      '/repo/notes.md'
    ])
  })

  it('keeps every file when no set is bound to a folder', () => {
    const files = ['/repo/design/shell-a/design.json', '/repo/notes.md']
    expect(withoutBoundDesignFiles(files, (path) => path, [])).toEqual(files)
  })
})
