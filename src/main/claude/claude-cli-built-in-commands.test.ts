import { describe, expect, it } from 'vitest'
import { CLAUDE_BUILT_IN_COMMANDS } from './claude-cli-built-in-commands'

const names = CLAUDE_BUILT_IN_COMMANDS.map((command) => command.name)

describe('Claude built-in commands a session runs as text', () => {
  it('lists each command once, with the description the CLI gives it', () => {
    expect(new Set(names).size).toBe(names.length)
    for (const command of CLAUDE_BUILT_IN_COMMANDS) {
      expect(command.description.trim()).not.toBe('')
      expect(command.description).not.toContain('\n')
    }
  })

  it('leaves out host-owned, terminal-only, and absent commands', () => {
    const excluded = [
      'clear',
      'compact',
      'model',
      'effort',
      'exit',
      'stop',
      'agents',
      'extra-usage',
      'memory',
      'hooks',
      'help',
      'permissions',
      'theme',
      'diff',
      'copy',
      'export',
      'status',
      'tasks',
      'resume',
      'plugin',
      'skills',
      'session',
      'btw',
      'login',
      'logout',
      // focus is a local-jsx command (needs the TUI's ink renderer); 2.1.296 has no output-style command
      'focus',
      'output-style'
    ]
    for (const name of excluded) {
      expect(names).not.toContain(name)
    }
  })

  it('keeps the non-interactive built-ins a chat can send, such as /context and /init', () => {
    expect(names).toEqual(
      expect.arrayContaining(['context', 'init', 'mcp', 'usage', 'security-review'])
    )
  })
})
