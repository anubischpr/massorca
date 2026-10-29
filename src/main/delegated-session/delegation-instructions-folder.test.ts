import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  it('stays whole and leaves no temp file when many chats start at once', async () => {
    const state = mkdtempSync(join(tmpdir(), 'orca-delegation-instructions-'))
    const folders = await Promise.all(
      Array.from({ length: 12 }, () => ensureDelegationInstructionsFolder(state))
    )
    const folder = folders[0] ?? ''
    expect(new Set(folders).size).toBe(1)
    expect(readdirSync(folder)).toEqual(['AGENTS.md'])
    expect(readFileSync(join(folder, 'AGENTS.md'), 'utf8')).toBe(`${DELEGATION_AGENT_INSTRUCTIONS}
`)
  })
})
