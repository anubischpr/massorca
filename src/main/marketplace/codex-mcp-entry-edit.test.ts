import { describe, expect, it } from 'vitest'
import { withCodexMcpEntry } from './codex-mcp-entry-edit'

const BODY = ['command = "engram"', 'args = ["mcp"]']

describe('withCodexMcpEntry', () => {
  it('refuses a config.toml with a broken table header instead of appending to it', () => {
    expect(withCodexMcpEntry('[[[ nope\nmodel = "x"\n', 'engram', BODY)).toBeNull()
    expect(withCodexMcpEntry('[unclosed\n', 'engram', null)).toBeNull()
  })

  it('still edits a valid file whose strings or arrays contain brackets', () => {
    const source = 'note = "[not a header"\nlist = [\n  "a",\n]\n'
    expect(withCodexMcpEntry(source, 'engram', BODY)).toBe(
      `${source}\n[mcp_servers.engram]\ncommand = "engram"\nargs = ["mcp"]\n`
    )
  })
})
