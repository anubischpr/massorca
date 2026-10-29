import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLI_GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'
import {
  DELEGATION_AGENT_INSTRUCTIONS,
  DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE,
  delegationInstructionsForEnv
} from './delegation-agent-instructions'

describe('delegation agent instructions', () => {
  it('names only flags the delegate command accepts', () => {
    // The CLI sits outside the main-process project, so its spec is read as text.
    const specSource = readFileSync(
      join(__dirname, '../../cli/specs/orchestration-worker-specs.ts'),
      'utf8'
    )
    const delegate = specSource.slice(specSource.indexOf("path: ['orchestration', 'delegate']"))
    const allowed = /allowedFlags: \[([^\]]*)\]/.exec(delegate)?.[1] ?? ''
    const flags = [...DELEGATION_AGENT_INSTRUCTIONS.matchAll(/--([a-z-]+)/g)].map((m) => m[1])
    expect(flags).toEqual(expect.arrayContaining(['summary', 'prompt', 'title', 'writes', 'json']))
    // `json` is accepted through the shared global flags, not the command's own list.
    for (const flag of flags) {
      expect(CLI_GLOBAL_FLAGS.includes(flag) || allowed.includes(`'${flag}'`)).toBe(true)
    }
  })

  it('forbids the internal subagent tools of every structured agent', () => {
    for (const name of ['Task', 'Agent', 'invoke_subagent', 'self']) {
      expect(DELEGATION_AGENT_INSTRUCTIONS).toContain(name)
    }
    expect(DELEGATION_AGENT_INSTRUCTIONS).toMatch(/only way to create a child session/)
  })

  it('keeps the one-line form free of newlines and cmd.exe metacharacters', () => {
    expect(DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE).not.toMatch(/[\r\n"<>|&%^]/)
  })

  it('is returned only when the child env carries the caller id and the CLI launcher', () => {
    const env = { ORCA_AGENT_SESSION_ID: 'session-1', ORCA_CLI_COMMAND: '/app/bin/orca' }
    expect(delegationInstructionsForEnv(env)).toBe(DELEGATION_AGENT_INSTRUCTIONS)
    expect(delegationInstructionsForEnv(env, 'one-line')).toBe(
      DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE
    )
    expect(delegationInstructionsForEnv({ ORCA_AGENT_SESSION_ID: 'session-1' })).toBeNull()
    expect(delegationInstructionsForEnv({ ORCA_CLI_COMMAND: '/app/bin/orca' })).toBeNull()
    expect(delegationInstructionsForEnv({})).toBeNull()
  })
})
