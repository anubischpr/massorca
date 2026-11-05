import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { editTextFileWithBackup } from './agent-file-write'
import { canCreateFileLinks } from './marketplace-apps-test-fixtures'

let home: string
let outside: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'marketplace-write-home-'))
  outside = mkdtempSync(join(tmpdir(), 'marketplace-write-outside-'))
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

const fileLinksWork = canCreateFileLinks()
const LINKS_SKIP_REASON = 'this machine cannot create file symlinks without elevated privileges'

const appendLine = (line: string) => (current: string | null) => `${current ?? ''}${line}\n`

describe('editTextFileWithBackup keeps writes inside the home folder', () => {
  it.skipIf(!fileLinksWork)(
    `refuses a file link that leaves the home and leaves its target untouched (${LINKS_SKIP_REASON})`,
    () => {
      const target = join(outside, 'mcp.json')
      writeFileSync(target, '{"keep":"me"}\n')
      const link = join(home, 'mcp.json')
      symlinkSync(target, link, 'file')
      const before = readFileSync(target)

      const result = editTextFileWithBackup(link, appendLine('{}'), 'text', home)

      expect(result).toEqual({ kind: 'failed', reason: 'outside-home' })
      expect(readFileSync(target).equals(before)).toBe(true)
      expect(lstatSync(link).isSymbolicLink()).toBe(true)
      expect(existsSync(`${target}.massorca-backup`)).toBe(false)
      expect(existsSync(`${target}.massorca-original`)).toBe(false)
    }
  )

  it('refuses a folder link that leaves the home for a file that does not exist yet', () => {
    symlinkSync(outside, join(home, 'linked'), 'junction')

    const result = editTextFileWithBackup(
      join(home, 'linked', 'new.json'),
      appendLine('{}'),
      'text',
      home
    )

    expect(result).toEqual({ kind: 'failed', reason: 'outside-home' })
    expect(existsSync(join(outside, 'new.json'))).toBe(false)
  })

  it('refuses a folder link that leaves the home for an existing file', () => {
    writeFileSync(join(outside, 'mcp.json'), 'original')
    symlinkSync(outside, join(home, 'linked'), 'junction')

    const result = editTextFileWithBackup(
      join(home, 'linked', 'mcp.json'),
      appendLine('x'),
      'text',
      home
    )

    expect(result).toEqual({ kind: 'failed', reason: 'outside-home' })
    expect(readFileSync(join(outside, 'mcp.json'), 'utf8')).toBe('original')
  })

  it('refuses the same link for a TOML file', () => {
    writeFileSync(join(outside, 'config.toml'), 'model = "x"\n')
    symlinkSync(outside, join(home, 'linked'), 'junction')

    const result = editTextFileWithBackup(
      join(home, 'linked', 'config.toml'),
      appendLine('a = 1'),
      'toml',
      home
    )

    expect(result).toEqual({ kind: 'failed', reason: 'outside-home' })
    expect(readFileSync(join(outside, 'config.toml'), 'utf8')).toBe('model = "x"\n')
    expect(existsSync(join(outside, 'config.toml.bak'))).toBe(false)
  })

  it('still writes through a folder link that stays inside the home', () => {
    const dotfiles = join(home, 'dotfiles')
    mkdirSync(dotfiles)
    writeFileSync(join(dotfiles, 'mcp.json'), 'before\n')
    symlinkSync(dotfiles, join(home, 'linked'), 'junction')

    const result = editTextFileWithBackup(
      join(home, 'linked', 'mcp.json'),
      appendLine('after'),
      'text',
      home
    )

    expect(result).toEqual({ kind: 'written' })
    expect(readFileSync(join(dotfiles, 'mcp.json'), 'utf8')).toBe('before\nafter\n')
  })

  it.skipIf(!fileLinksWork)(
    `still writes through a file link that stays inside the home (${LINKS_SKIP_REASON})`,
    () => {
      const target = join(home, 'dotfiles', 'mcp.json')
      mkdirSync(join(home, 'dotfiles'))
      writeFileSync(target, 'before\n')
      const link = join(home, 'mcp.json')
      symlinkSync(target, link, 'file')

      const result = editTextFileWithBackup(link, appendLine('after'), 'text', home)

      expect(result).toEqual({ kind: 'written' })
      expect(readFileSync(target, 'utf8')).toBe('before\nafter\n')
      expect(lstatSync(link).isSymbolicLink()).toBe(true)
    }
  )

  it('keeps an explicitly configured location outside the home, since no link led there', () => {
    const path = join(outside, 'claude.json')
    writeFileSync(path, 'before\n')

    expect(editTextFileWithBackup(path, appendLine('after'), 'text', home)).toEqual({
      kind: 'written'
    })
    expect(readFileSync(path, 'utf8')).toBe('before\nafter\n')
  })

  it('does not check anything when no home is given', () => {
    writeFileSync(join(outside, 'mcp.json'), 'before\n')
    symlinkSync(outside, join(home, 'linked'), 'junction')

    expect(
      editTextFileWithBackup(join(home, 'linked', 'mcp.json'), appendLine('after'), 'text')
    ).toEqual({ kind: 'written' })
  })

  it('reports an edit that changes nothing even when the file links out', () => {
    writeFileSync(join(outside, 'mcp.json'), 'same')
    symlinkSync(outside, join(home, 'linked'), 'junction')

    expect(
      editTextFileWithBackup(join(home, 'linked', 'mcp.json'), (current) => current, 'text', home)
    ).toEqual({ kind: 'unchanged' })
  })
})

describe('editTextFileWithBackup keeps the first original', () => {
  it.each(['text', 'toml'] as const)('keeps the untouched bytes after two %s writes', (mode) => {
    const path = join(home, mode === 'toml' ? 'config.toml' : 'mcp.json')
    const original = Buffer.from([0x7b, 0x7d, 0x0d, 0x0a, 0xc3, 0xa9])
    writeFileSync(path, original)

    expect(editTextFileWithBackup(path, appendLine('one'), mode, home)).toEqual({ kind: 'written' })
    expect(editTextFileWithBackup(path, appendLine('two'), mode, home)).toEqual({ kind: 'written' })

    expect(readFileSync(`${path}.massorca-original`).equals(original)).toBe(true)
    const rolling = mode === 'toml' ? `${path}.bak` : `${path}.massorca-backup`
    expect(readFileSync(rolling, 'utf8')).toContain('one')
    expect(readFileSync(rolling, 'utf8')).not.toContain('two')
  })

  it('writes no original for a file that did not exist', () => {
    const path = join(home, 'mcp.json')

    expect(editTextFileWithBackup(path, appendLine('one'), 'text', home)).toEqual({
      kind: 'written'
    })

    expect(existsSync(`${path}.massorca-original`)).toBe(false)
  })

  it('does not keep an original when the edit is refused', () => {
    const path = join(home, 'mcp.json')
    writeFileSync(path, 'x')

    expect(editTextFileWithBackup(path, () => null, 'text', home)).toEqual({
      kind: 'failed',
      reason: 'unsupported-shape'
    })

    expect(existsSync(`${path}.massorca-original`)).toBe(false)
  })
})
