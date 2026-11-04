import { describe, expect, it } from 'vitest'
import { MAX_CUSTOM_COMMAND_LENGTH, parseCustomCommandArgv } from './custom-command-argv'

describe('parseCustomCommandArgv', () => {
  it('splits on spaces and tabs', () => {
    expect(parseCustomCommandArgv('winget  install\tmytool')).toEqual([
      'winget',
      'install',
      'mytool'
    ])
  })

  it('keeps double-quoted and single-quoted text together, without the quotes', () => {
    expect(parseCustomCommandArgv(`tool "two words" 'and more'`)).toEqual([
      'tool',
      'two words',
      'and more'
    ])
  })

  it('keeps a quote of the other kind inside quotes', () => {
    expect(parseCustomCommandArgv(`tool 'say "hi"'`)).toEqual(['tool', 'say "hi"'])
  })

  it('joins adjacent quoted and bare text into one argument', () => {
    expect(parseCustomCommandArgv('tool --name="my app"')).toEqual(['tool', '--name=my app'])
  })

  it('keeps an explicit empty argument', () => {
    expect(parseCustomCommandArgv('tool ""')).toEqual(['tool', ''])
  })

  it('keeps backslashes, so Windows paths survive', () => {
    expect(parseCustomCommandArgv('"C:\\Program Files\\Tool\\tool.exe" --version')).toEqual([
      'C:\\Program Files\\Tool\\tool.exe',
      '--version'
    ])
  })

  it.each(['|', '&', ';', '<', '>', '$', '`'])('refuses the shell operator %s', (operator) => {
    expect(parseCustomCommandArgv(`tool a${operator}b`)).toBeNull()
  })

  it('refuses a shell operator even inside quotes', () => {
    expect(parseCustomCommandArgv('tool "a | b"')).toBeNull()
  })

  it.each(['\n', '\r', '\u0000', '\u001b'])('refuses the control character %j', (char) => {
    expect(parseCustomCommandArgv(`tool${char}--version`)).toBeNull()
  })

  it('refuses an unclosed quote', () => {
    expect(parseCustomCommandArgv('tool "open')).toBeNull()
  })

  it('refuses an empty command and a blank program', () => {
    expect(parseCustomCommandArgv('')).toBeNull()
    expect(parseCustomCommandArgv('   ')).toBeNull()
    expect(parseCustomCommandArgv('"" --version')).toBeNull()
  })

  it('refuses a command longer than the limit', () => {
    expect(parseCustomCommandArgv(`tool ${'a'.repeat(MAX_CUSTOM_COMMAND_LENGTH)}`)).toBeNull()
  })
})
