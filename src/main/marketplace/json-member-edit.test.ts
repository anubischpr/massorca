import { describe, expect, it } from 'vitest'
import { editJsonContainerMember, parseJsonObject } from './json-member-edit'

const BOM = String.fromCharCode(0xfeff)

const entry = { command: 'engram', args: ['mcp'] }

function roundTrip(original: string, container = 'mcpServers'): string | null {
  const added = editJsonContainerMember(original, container, 'engram', entry)
  return added === null ? null : editJsonContainerMember(added, container, 'engram', undefined)
}

describe('editJsonContainerMember', () => {
  it.each([
    [
      'LF with final newline',
      '{\n  "a": 1,\n  "mcpServers": {\n    "x": { "command": "x" }\n  }\n}\n'
    ],
    ['CRLF', '{\r\n  "a": 1,\r\n  "mcpServers": {\r\n    "x": 1\r\n  }\r\n}\r\n'],
    ['no final newline', '{\n  "a": 1,\n  "mcpServers": {\n    "x": 1\n  }\n}'],
    ['tab indent', '{\n\t"mcpServers": {\n\t\t"x": 1\n\t},\n\t"a": 2\n}\n'],
    ['four-space indent', '{\n    "mcpServers": {\n        "x": 1\n    }\n}\n'],
    ['compact one line', '{"a":1,"mcpServers":{"x":1}}'],
    ['empty container', '{\n  "a": 1,\n  "mcpServers": {}\n}\n'],
    ['empty container, compact', '{"mcpServers":{}}'],
    [
      'big numbers untouched',
      '{\n  "n": 12345678901234567890,\n  "mcpServers": {\n    "x": 1.50\n  }\n}\n'
    ],
    [
      'byte order mark kept',
      `${BOM}{
  "mcpServers": {
    "x": 1
  }
}
`
    ]
  ])('adds then removes an entry byte for byte (%s)', (_label, original) => {
    expect(roundTrip(original)).toBe(original)
  })

  it('writes the entry in the file own indent and line ending', () => {
    const added = editJsonContainerMember(
      '{\r\n\t"mcpServers": {\r\n\t\t"x": 1\r\n\t}\r\n}\r\n',
      'mcpServers',
      'engram',
      entry
    )
    expect(added).toBe(
      '{\r\n\t"mcpServers": {\r\n\t\t"x": 1,\r\n\t\t"engram": {\r\n\t\t\t"command": "engram",\r\n\t\t\t"args": [\r\n\t\t\t\t"mcp"\r\n\t\t\t]\r\n\t\t}\r\n\t}\r\n}\r\n'
    )
  })

  it('creates the container when it is missing and keeps the other members', () => {
    const added = editJsonContainerMember('{\n  "theme": "dark"\n}\n', 'servers', 'engram', entry)
    expect(JSON.parse(added ?? '')).toEqual({ theme: 'dark', servers: { engram: entry } })
    expect(added?.startsWith('{\n  "theme": "dark",\n  "servers": {')).toBe(true)
  })

  it('removes a member from the middle, the start and the end', () => {
    const text = '{\n  "s": {\n    "a": 1,\n    "b": 2,\n    "c": 3\n  }\n}\n'
    expect(editJsonContainerMember(text, 's', 'b', undefined)).toBe(
      '{\n  "s": {\n    "a": 1,\n    "c": 3\n  }\n}\n'
    )
    expect(editJsonContainerMember(text, 's', 'a', undefined)).toBe(
      '{\n  "s": {\n    "b": 2,\n    "c": 3\n  }\n}\n'
    )
    expect(editJsonContainerMember(text, 's', 'c', undefined)).toBe(
      '{\n  "s": {\n    "a": 1,\n    "b": 2\n  }\n}\n'
    )
  })

  it('replaces only the value of an existing member and is idempotent', () => {
    const text = '{\n  "s": {\n    "a": { "url": "old" },\n    "b": 2\n  }\n}\n'
    const replaced = editJsonContainerMember(text, 's', 'a', { url: 'new' })
    expect(JSON.parse(replaced ?? '')).toEqual({ s: { a: { url: 'new' }, b: 2 } })
    expect(replaced).toContain('    "b": 2\n')
    expect(editJsonContainerMember(replaced, 's', 'a', { url: 'new' })).toBe(replaced)
  })

  it('creates a missing file and leaves a missing file alone on removal', () => {
    expect(JSON.parse(editJsonContainerMember(null, 'mcpServers', 'engram', entry) ?? '')).toEqual({
      mcpServers: { engram: entry }
    })
    expect(editJsonContainerMember(null, 'mcpServers', 'engram', undefined)).toBe('')
  })

  it('does not match a key that only appears nested', () => {
    const text = '{"other":{"mcpServers":{"engram":1}},"mcpServers":{}}'
    expect(editJsonContainerMember(text, 'mcpServers', 'engram', undefined)).toBe(text)
  })

  it('reads and edits JSON saved with a byte order mark, and keeps the mark', () => {
    const saved = `${BOM}{"mcpServers":{"x":1}}`
    expect(parseJsonObject(saved)).toEqual({ mcpServers: { x: 1 } })
    const added = editJsonContainerMember(saved, 'mcpServers', 'engram', entry)
    expect(added?.startsWith(BOM)).toBe(true)
    expect(JSON.parse(added?.slice(BOM.length) ?? '')).toEqual({
      mcpServers: { x: 1, engram: entry }
    })
  })

  it.each([
    ['not an object', '[]'],
    ['container is a list', '{"mcpServers":[]}'],
    ['container is a string', '{"mcpServers":"x"}'],
    ['comments', '{\n // c\n "mcpServers": {}\n}'],
    ['repeated container', '{"mcpServers":{},"mcpServers":{}}'],
    ['repeated entry', '{"mcpServers":{"engram":1,"engram":2}}'],
    ['broken', '{not json']
  ])('refuses %s', (_label, text) => {
    expect(editJsonContainerMember(text, 'mcpServers', 'engram', entry)).toBeNull()
  })
})
