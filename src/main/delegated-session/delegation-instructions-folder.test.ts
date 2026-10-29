import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DELEGATION_AGENT_INSTRUCTIONS } from './delegation-agent-instructions'
import { ensureDelegationInstructionsFolder } from './delegation-instructions-folder'

describe('ensureDelegationInstructionsFolder', () => {
  it('writes the instructions as AGENTS.md and repairs a stale copy', async () => {
    const state = mkdtempSync(join(tmpdir(), 'orca-delegation-instructions-'))
    const folder = await ensureDelegationInstructionsFolder(state)
    const file = join(folder ?? '', 'AGENTS.md')
    expect(readFileSync(file, 'utf8')).toBe(`${DELEGATION_AGENT_INSTRUCTIONS}\n`)

    writeFileSync(file, 'stale')
    await ensureDelegationInstructionsFolder(state)
    expect(readFileSync(file, 'utf8')).toBe(`${DELEGATION_AGENT_INSTRUCTIONS}\n`)
  })

  it('returns null when the state directory cannot hold the folder', async () => {
    const state = mkdtempSync(join(tmpdir(), 'orca-delegation-instructions-'))
    const blocker = join(state, 'file')
    writeFileSync(blocker, '')
    await expect(ensureDelegationInstructionsFolder(blocker)).resolves.toBeNull()
  })
})
