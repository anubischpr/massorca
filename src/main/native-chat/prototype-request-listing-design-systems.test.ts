import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ListPrototypeSetsReplySchema } from '../../shared/rpc-contract/prototype-params'
import { createPrototypeRequest, listPrototypeSets } from './prototype-requests'

const SESSION = 'session-test-0001'
const OTHER_SESSION = 'session-test-0002'
const NOW = new Date('2026-10-28T20:15:00.000Z')
const LATER = new Date('2026-10-28T20:16:00.000Z')
const LATEST = new Date('2026-10-28T20:17:00.000Z')
const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 2, status: 'proposed', agent: 'Claude' } }
})

let stateDirectory: string
let projectDirectory: string
let otherProjectDirectory: string
const launchDirectories = new Map<string, string>()
const launchDirectoryOf = (sessionId: string): string | undefined =>
  launchDirectories.get(sessionId)

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-state-'))
  projectDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-project-'))
  otherProjectDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-other-'))
  await mkdir(join(projectDirectory, '.git'))
  await mkdir(join(otherProjectDirectory, '.git'))
  launchDirectories.set(SESSION, projectDirectory)
  launchDirectories.set(OTHER_SESSION, otherProjectDirectory)
})

afterEach(async () => {
  launchDirectories.clear()
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(projectDirectory, { recursive: true, force: true })
  await rm(otherProjectDirectory, { recursive: true, force: true })
})

async function writeTokensIn(root: string): Promise<void> {
  await mkdir(join(root, 'design', 'system'), { recursive: true })
  await writeFile(join(root, 'design', 'system', 'tokens.json'), TOKENS)
}

async function create(
  sessionId: string,
  now: Date,
  designSystem?: 'use' | 'propose' | 'skip'
): Promise<{ requestId: string; folderPath: string }> {
  const result = await createPrototypeRequest({
    stateDirectory,
    sessionId,
    launchDirectory: launchDirectories.get(sessionId),
    request: {
      agent: 'claude',
      originalPrompt: 'a dashboard',
      count: 2,
      ...(designSystem !== undefined ? { designSystem } : {})
    },
    now,
    random: () => 0
  })
  if (!result.ok) {
    throw new Error('expected a created request')
  }
  return { requestId: result.requestId, folderPath: result.folderPath }
}

describe('listPrototypeSets design systems', () => {
  it('lists the design system of a project whose only request has no direction files', async () => {
    await writeTokensIn(projectDirectory)
    await create(SESSION, NOW, 'skip')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.sets).toEqual([])
    expect(listed.designSystems).toHaveLength(1)
    expect(listed.designSystems?.[0]).toMatchObject({
      projectName: basename(projectDirectory),
      status: 'proposed',
      version: 2,
      tokenCount: 1
    })
    expect(listed.designSystems?.[0]).not.toHaveProperty('pendingRequest')
    expect(ListPrototypeSetsReplySchema.safeParse(listed).success).toBe(true)
  })

  it('names the newest proposal that has no direction files as the request Approve builds', async () => {
    await writeTokensIn(projectDirectory)
    const pending = await create(SESSION, NOW, 'propose')
    const made = await create(SESSION, LATER, 'propose')
    await writeFile(join(made.folderPath, 'A.html'), '<p>a</p>')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.sets.map((set) => set.requestId)).toEqual([made.requestId])
    expect(listed.designSystems?.[0]?.pendingRequest).toEqual({
      requestId: pending.requestId,
      sessionId: SESSION,
      agent: 'claude'
    })
  })

  it('takes the newest proposal with no direction files, and never a use or skip request', async () => {
    await writeTokensIn(projectDirectory)
    const proposal = await create(SESSION, NOW, 'propose')
    await create(SESSION, LATER, 'use')
    await create(SESSION, LATEST, 'skip')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems?.[0]?.pendingRequest?.requestId).toBe(proposal.requestId)
  })

  it('leaves out pendingRequest when the project has no request to approve', async () => {
    await writeTokensIn(projectDirectory)
    const made = await create(SESSION, NOW, 'use')
    await writeFile(join(made.folderPath, 'A.html'), '<p>a</p>')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems?.[0]).not.toHaveProperty('pendingRequest')
  })

  it('keeps the pending request with the project it belongs to', async () => {
    await writeTokensIn(projectDirectory)
    const pending = await create(SESSION, NOW, 'propose')
    const otherProposal = await create(OTHER_SESSION, LATEST, 'propose')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems).toHaveLength(1)
    expect(listed.designSystems?.[0]?.projectName).toBe(basename(projectDirectory))
    expect(listed.designSystems?.[0]?.pendingRequest?.requestId).toBe(pending.requestId)
    expect(listed.designSystems?.[0]?.pendingRequest?.requestId).not.toBe(otherProposal.requestId)
  })

  it('lists no design system for a project that has no tokens.json', async () => {
    await create(OTHER_SESSION, NOW, 'propose')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems).toBeUndefined()
    expect(listed.sets).toEqual([])
  })

  it('lists a project’s system once for all of its requests', async () => {
    await writeTokensIn(projectDirectory)
    const first = await create(SESSION, NOW, 'skip')
    await writeFile(join(first.folderPath, 'A.html'), '<p>a</p>')
    await create(SESSION, LATER, 'use')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems).toHaveLength(1)
    expect(listed.sets.map((set) => set.projectKey)).toEqual([
      listed.designSystems?.[0]?.projectKey
    ])
  })

  it('does not list the design system of another project', async () => {
    await writeTokensIn(otherProjectDirectory)
    await create(SESSION, NOW, 'skip')

    const listed = await listPrototypeSets({ launchDirectoryOf, stateDirectory })

    expect(listed.designSystems).toBeUndefined()
  })
})
