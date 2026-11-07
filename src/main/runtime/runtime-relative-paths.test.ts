// The guard every workspace file write (files.writeBase64 included) passes before touching disk.

import { describe, expect, it } from 'vitest'
import { normalizeRuntimeRelativePath } from './runtime-relative-paths'

describe('a workspace-relative path', () => {
  it.each([
    ['a parent step', '../outside.txt', '/home/me/ws'],
    ['a nested parent step', 'attachments/../../outside.txt', '/home/me/ws'],
    ['a POSIX absolute path', '/etc/passwd', '/home/me/ws'],
    ['a Windows parent step', '..\\outside.txt', 'C:\\Users\\me\\ws'],
    ['a Windows drive path', 'C:\\Windows\\win.ini', 'C:\\Users\\me\\ws'],
    ['a UNC path', '\\\\server\\share\\file', 'C:\\Users\\me\\ws'],
    ['a current-folder step', './attachments/a.png', '/home/me/ws'],
    ['an empty segment', 'attachments//a.png', '/home/me/ws']
  ])('rejects %s', (_case, relativePath, root) => {
    expect(() => normalizeRuntimeRelativePath(relativePath, root)).toThrow('invalid_relative_path')
  })

  it('keeps a plain path under the root', () => {
    expect(normalizeRuntimeRelativePath('attachments/a.png', '/home/me/ws')).toBe(
      'attachments/a.png'
    )
    expect(normalizeRuntimeRelativePath('attachments\\a.png', 'C:\\Users\\me\\ws')).toBe(
      'attachments/a.png'
    )
  })
})
