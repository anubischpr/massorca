import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSessionFilePath } from './session-file-resolver'

const CONVERSATION_ID = '61da7062-00a1-416c-8fea-a1ca13f5f664'
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function writeTranscript(home: string, origin: string, id: string): Promise<string> {
  const file = join(
    home,
    '.gemini',
    origin,
    'brain',
    id,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  )
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, '')
  return file
}

describe('resolveSessionFilePath for Antigravity', () => {
  it('finds the conversation transcript under whichever install origin holds it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-antigravity-home-'))
    roots.push(home)
    const expected = await writeTranscript(home, 'antigravity-ide', CONVERSATION_ID)
    await expect(
      resolveSessionFilePath('antigravity', CONVERSATION_ID, { antigravityHomeDir: home })
    ).resolves.toBe(expected)
  })

  it('prefers the CLI origin when several origins hold the same conversation id', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-antigravity-home-'))
    roots.push(home)
    await writeTranscript(home, 'antigravity', CONVERSATION_ID)
    const cli = await writeTranscript(home, 'antigravity-cli', CONVERSATION_ID)
    await expect(
      resolveSessionFilePath('antigravity', CONVERSATION_ID, { antigravityHomeDir: home })
    ).resolves.toBe(cli)
  })

  it('returns null for a missing conversation and rejects path-shaped ids', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-antigravity-home-'))
    roots.push(home)
    await expect(
      resolveSessionFilePath('antigravity', CONVERSATION_ID, { antigravityHomeDir: home })
    ).resolves.toBeNull()
    await expect(
      resolveSessionFilePath('antigravity', '../escape', { antigravityHomeDir: home })
    ).resolves.toBeNull()
  })
})
