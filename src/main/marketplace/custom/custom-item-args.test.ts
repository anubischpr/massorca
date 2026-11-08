import { describe, expect, it } from 'vitest'
import {
  MAX_CUSTOM_NAME_LENGTH,
  marketplacePlatform,
  parseAddArgs,
  parseIdArgs
} from './custom-item-args'

describe('parseAddArgs', () => {
  it('parses a tool with a check command and per-platform installs', () => {
    expect(
      parseAddArgs({
        kind: 'tool',
        name: '  MyTool ',
        checkCommand: 'mytool --version',
        install: { win32: 'winget install mytool', linux: 'apt-get install -y "my tool"' }
      })
    ).toEqual({
      kind: 'tool',
      name: 'MyTool',
      checkCommand: ['mytool', '--version'],
      install: {
        win32: ['winget', 'install', 'mytool'],
        linux: ['apt-get', 'install', '-y', 'my tool']
      }
    })
  })

  it('treats blank install entries as left out', () => {
    expect(
      parseAddArgs({
        kind: 'agent',
        name: 'Agent',
        checkCommand: 'agent -v',
        install: { win32: '  ', darwin: '' }
      })
    ).toMatchObject({ install: {} })
  })

  it('parses a skill from its link, with no commands', () => {
    expect(
      parseAddArgs({
        kind: 'skill',
        name: 'Review skill',
        skillUrl: 'https://example.com/skills/r'
      })
    ).toEqual({
      kind: 'skill',
      name: 'Review skill',
      checkCommand: null,
      install: {},
      skillUrl: 'https://example.com/skills/r'
    })
  })

  it('refuses a tool or agent without a check command', () => {
    expect(parseAddArgs({ kind: 'tool', name: 'Tool' })).toBeNull()
    expect(parseAddArgs({ kind: 'tool', name: 'Tool', checkCommand: '   ' })).toBeNull()
  })

  it('refuses a check or install command with a shell operator', () => {
    expect(
      parseAddArgs({ kind: 'tool', name: 'Tool', checkCommand: 'tool --version | more' })
    ).toBeNull()
    expect(
      parseAddArgs({
        kind: 'tool',
        name: 'Tool',
        checkCommand: 'tool --version',
        install: { linux: 'apt-get install x && reboot' }
      })
    ).toBeNull()
  })

  it('refuses an unknown key, including an unknown platform', () => {
    expect(
      parseAddArgs({ kind: 'tool', name: 'Tool', checkCommand: 'tool -v', extra: true })
    ).toBeNull()
    expect(
      parseAddArgs({
        kind: 'tool',
        name: 'Tool',
        checkCommand: 'tool -v',
        install: { freebsd: 'pkg install tool' }
      })
    ).toBeNull()
  })

  it('refuses a kind it does not know', () => {
    expect(parseAddArgs({ kind: 'plugin', name: 'Tool', checkCommand: 'tool -v' })).toBeNull()
  })

  it('refuses a blank, long, or multi-line name', () => {
    expect(parseAddArgs({ kind: 'tool', name: '   ', checkCommand: 'tool -v' })).toBeNull()
    expect(
      parseAddArgs({
        kind: 'tool',
        name: 'x'.repeat(MAX_CUSTOM_NAME_LENGTH + 1),
        checkCommand: 'tool -v'
      })
    ).toBeNull()
    expect(parseAddArgs({ kind: 'tool', name: 'Tool\nTwo', checkCommand: 'tool -v' })).toBeNull()
  })

  it('refuses a skill without a link, or with a check or install command', () => {
    expect(parseAddArgs({ kind: 'skill', name: 'S' })).toBeNull()
    expect(
      parseAddArgs({
        kind: 'skill',
        name: 'S',
        skillUrl: 'https://example.com/s',
        checkCommand: 'skill -v'
      })
    ).toBeNull()
    expect(
      parseAddArgs({
        kind: 'skill',
        name: 'S',
        skillUrl: 'https://example.com/s',
        install: { win32: 'x' }
      })
    ).toBeNull()
  })

  it('refuses a tool that carries a link', () => {
    expect(
      parseAddArgs({
        kind: 'tool',
        name: 'Tool',
        checkCommand: 'tool -v',
        skillUrl: 'https://example.com/s'
      })
    ).toBeNull()
  })

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:secret@example.com/skill',
    'https://example.com/skill?token=abc'
  ])('refuses the skill link %s', (skillUrl) => {
    expect(parseAddArgs({ kind: 'skill', name: 'S', skillUrl })).toBeNull()
  })

  it('refuses input that is not an object', () => {
    expect(parseAddArgs(null)).toBeNull()
    expect(parseAddArgs('tool')).toBeNull()
  })
})

describe('parseIdArgs', () => {
  it('accepts an id', () => {
    expect(parseIdArgs({ id: 'abc-123' })).toBe('abc-123')
  })

  it('refuses a blank, missing, non-string, or extra-key id', () => {
    expect(parseIdArgs({ id: '' })).toBeNull()
    expect(parseIdArgs({})).toBeNull()
    expect(parseIdArgs({ id: 42 })).toBeNull()
    expect(parseIdArgs({ id: 'a', other: 1 })).toBeNull()
    expect(parseIdArgs('a')).toBeNull()
  })
})

describe('marketplacePlatform', () => {
  it('maps the three platforms the board supports and nothing else', () => {
    expect(marketplacePlatform('win32')).toBe('win32')
    expect(marketplacePlatform('darwin')).toBe('darwin')
    expect(marketplacePlatform('linux')).toBe('linux')
    expect(marketplacePlatform('freebsd')).toBeNull()
  })
})
