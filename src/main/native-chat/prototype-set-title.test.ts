import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../shared/constants'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import { generateConversationNameFromContext } from '../text-generation/commit-message-text-generation'
import { readRequestManifest } from './prototype-request-disk'
import { createPrototypeRequest } from './prototype-requests'
import { prototypeSetTitleGenerator, writePrototypeSetTitle } from './prototype-set-title'

vi.mock('../text-generation/commit-message-text-generation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateConversationNameFromContext: vi.fn()
}))
vi.mock('../agent-hooks/first-work-generation-target', () => ({
  resolveGenerationTarget: vi.fn()
}))

type TitleInput = { originalPrompt: string; launchDirectory: string }

const SESSION = 'session-test-0001'
const NOW = new Date('2026-10-30T10:00:00.000Z')
const PROMPT = 'Build an opportunities impact explorer with filters'
const FIXED_RANDOM = (): number => 0

let stateDirectory: string
let launchDirectory: string

beforeEach(async () => {
  vi.clearAllMocks()
  stateDirectory = await mkdtemp(join(tmpdir(), 'prototype-set-title-state-'))
  launchDirectory = await mkdtemp(join(tmpdir(), 'prototype-set-title-launch-'))
  vi.mocked(resolveGenerationTarget).mockResolvedValue({ kind: 'local', cwd: launchDirectory })
})

afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(launchDirectory, { recursive: true, force: true })
})

async function createSet(generateTitle?: (input: TitleInput) => Promise<string | null>) {
  const result = await createPrototypeRequest({
    stateDirectory,
    sessionId: SESSION,
    launchDirectory,
    request: { agent: 'claude', originalPrompt: PROMPT, count: 2 },
    ...(generateTitle ? { generateTitle } : {}),
    now: NOW,
    random: FIXED_RANDOM
  })
  if (!result.ok) {
    throw new Error('expected a created request')
  }
  return result.folderPath
}

describe('prototypeSetTitleGenerator', () => {
  it('names the set from its visible request text with the chat-name generation', async () => {
    vi.mocked(generateConversationNameFromContext).mockResolvedValue({
      success: true,
      name: 'Opportunities explorer',
      agentLabel: 'Claude'
    })
    const generate = prototypeSetTitleGenerator({
      getStore: () => ({ getSettings: () => getDefaultSettings(tmpdir()) }),
      getAgentEnvResolvers: () => undefined
    })

    expect(await generate({ originalPrompt: PROMPT, launchDirectory })).toBe(
      'Opportunities explorer'
    )
    expect(generateConversationNameFromContext).toHaveBeenCalledWith(
      { firstPrompt: PROMPT },
      expect.objectContaining({ agentId: expect.any(String) }),
      { kind: 'local', cwd: launchDirectory }
    )
  })

  it('generates nothing when this host has no settings to name with', async () => {
    const generate = prototypeSetTitleGenerator({
      getStore: () => null,
      getAgentEnvResolvers: () => undefined
    })

    expect(await generate({ originalPrompt: PROMPT, launchDirectory })).toBeNull()
    expect(generateConversationNameFromContext).not.toHaveBeenCalled()
  })
})

describe('writePrototypeSetTitle', () => {
  it('adds the title to the manifest and keeps every other field', async () => {
    const folder = await createSet()

    expect(await writePrototypeSetTitle(folder, 'Opportunities explorer')).toBe(true)

    const manifest = await readRequestManifest(folder)
    expect(manifest?.title).toBe('Opportunities explorer')
    expect(manifest?.originalPrompt).toBe(PROMPT)
    expect(manifest?.count).toBe(2)
  })

  it('keeps a title that is already there', async () => {
    const folder = await createSet()
    await writePrototypeSetTitle(folder, 'Opportunities explorer')

    expect(await writePrototypeSetTitle(folder, 'Another name')).toBe(false)
    expect((await readRequestManifest(folder))?.title).toBe('Opportunities explorer')
  })

  it('writes nothing for a request folder that no longer has a manifest', async () => {
    expect(await writePrototypeSetTitle(join(stateDirectory, 'missing'), 'Name')).toBe(false)
  })
})

describe('prototype set naming after the send', () => {
  it('patches the generated title into the manifest once the send has returned', async () => {
    const generateTitle = vi.fn<(input: TitleInput) => Promise<string | null>>(
      async () => 'Opportunities explorer'
    )
    const folder = await createSet(generateTitle)

    await vi.waitFor(async () => {
      expect((await readRequestManifest(folder))?.title).toBe('Opportunities explorer')
    })
    expect(generateTitle).toHaveBeenCalledWith({ originalPrompt: PROMPT, launchDirectory })
  })

  it('leaves the set on its prompt text when naming yields no title', async () => {
    const generateTitle = vi.fn<(input: TitleInput) => Promise<string | null>>(async () => null)
    const folder = await createSet(generateTitle)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(generateTitle).toHaveBeenCalledTimes(1)
    expect((await readRequestManifest(folder))?.title).toBeUndefined()
  })
})
