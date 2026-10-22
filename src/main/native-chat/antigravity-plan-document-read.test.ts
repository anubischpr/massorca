import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PLAN_DOCUMENT_MAX_BYTES } from '../../shared/rpc-contract/agent-session-plan-document-params'
import { readAntigravityPlanDocument } from './antigravity-plan-document-read'

const CONVERSATION = '0954d0eb-8c6b-4f78-a8ed-8fafe8fab3c2'
// The sidecar agy wrote beside a plan mode document on a real run.
const SIDECAR = {
  summary: 'Plan',
  updatedAt: '2026-10-20T08:29:18Z',
  requestFeedback: true,
  userFacing: true
}

let root: string
let folder: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'agy-plan-read-'))
  folder = join(root, '.gemini', 'antigravity-cli', 'brain', CONVERSATION)
  await mkdir(folder, { recursive: true })
})
afterEach(() => rm(root, { recursive: true, force: true }))

async function artifact(
  name: string,
  text: string,
  sidecar: Partial<typeof SIDECAR> | null = SIDECAR
) {
  const path = join(folder, name)
  await writeFile(path, text)
  if (sidecar) {
    await writeFile(`${path}.metadata.json`, JSON.stringify(sidecar))
  }
  return path
}

const read = (path: string, ids: string[] = [CONVERSATION], knownRevision?: string) =>
  readAntigravityPlanDocument({
    path,
    conversationIds: new Set(ids),
    ...(knownRevision ? { knownRevision } : {})
  })

describe('readAntigravityPlanDocument', () => {
  it('reads a user-facing artifact inside the session conversation folder', async () => {
    const path = await artifact('implementation_plan.md', '# Plan\n')
    const first = await read(path)
    expect(first).toMatchObject({ ok: true, text: '# Plan\n', sizeBytes: 7 })
    // A rewrite is a new revision, and an unchanged file answers without the bytes.
    const revision = first.ok ? first.revision : ''
    expect(await read(path, [CONVERSATION], revision)).toMatchObject({ ok: true, unchanged: true })
    await writeFile(path, '# Plan v2\n')
    expect(await read(path, [CONVERSATION], revision)).toMatchObject({
      ok: true,
      text: '# Plan v2\n'
    })
  })

  it('refuses a conversation the session did not record, and paths outside brain/', async () => {
    const path = await artifact('plan.md', 'x')
    expect(await read(path, ['another-conversation'])).toEqual({
      ok: false,
      error: 'outside_folder'
    })
    const stray = join(root, CONVERSATION)
    await mkdir(stray)
    await writeFile(join(stray, 'plan.md'), 'x')
    await writeFile(join(stray, 'plan.md.metadata.json'), JSON.stringify(SIDECAR))
    expect(await read(join(stray, 'plan.md'))).toEqual({ ok: false, error: 'outside_folder' })
    expect(await read('plan.md')).toEqual({ ok: false, error: 'outside_folder' })
    expect(await read(`${path}.metadata.json`)).toEqual({ ok: false, error: 'outside_folder' })
  })

  it('refuses a file whose own sidecar does not mark it user-facing', async () => {
    const plain = await artifact('scratch.md', 'x', null)
    expect(await read(plain)).toEqual({ ok: false, error: 'not_a_plan_document' })
    const hidden = await artifact('hidden.md', 'x', { ...SIDECAR, userFacing: false })
    expect(await read(hidden)).toEqual({ ok: false, error: 'not_a_plan_document' })
  })

  it('refuses a symlink that leaves the conversation folder', async () => {
    const secret = join(root, 'secret.txt')
    await writeFile(secret, 'secret')
    const link = join(folder, 'leak.md')
    try {
      await symlink(secret, link)
    } catch {
      return // Symlinks need privileges on some Windows hosts.
    }
    await writeFile(`${link}.metadata.json`, JSON.stringify(SIDECAR))
    expect(await read(link)).toEqual({ ok: false, error: 'outside_folder' })
  })

  it('caps the size and accepts text only', async () => {
    const big = await artifact('big.md', 'a'.repeat(PLAN_DOCUMENT_MAX_BYTES + 1))
    expect(await read(big)).toEqual({ ok: false, error: 'too_large' })
    const binary = join(folder, 'binary.md')
    await writeFile(binary, Buffer.from([0x23, 0x00, 0x41]))
    await writeFile(`${binary}.metadata.json`, JSON.stringify(SIDECAR))
    expect(await read(binary)).toEqual({ ok: false, error: 'not_text' })
  })

  it('reports a missing file', async () => {
    const path = join(folder, 'gone.md')
    await writeFile(`${path}.metadata.json`, JSON.stringify(SIDECAR))
    expect(await read(path)).toEqual({ ok: false, error: 'not_found' })
  })
})
