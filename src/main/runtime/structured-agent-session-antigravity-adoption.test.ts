import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPtyIdForPaneKey } from '../ipc/pty/pane/key-state'
import {
  resolveAntigravityStructuredAgentSessionAdoptionForCreate,
  resolveResumeFromAdoptionForCreate
} from './structured-agent-session-create-adoption'

vi.mock('../ipc/pty/pane/key-state', () => ({ getPtyIdForPaneKey: vi.fn(() => undefined) }))

const CONVERSATION_ID = 'c47de08c-23c6-4c39-8c1f-3d449b9066ba'
const SELF_SESSION_ID = 'antigravity_adopt_1'
const roots: string[] = []

async function antigravityHome(): Promise<{ home: string; transcript: string }> {
  const home = await mkdtemp(join(tmpdir(), 'orca-antigravity-adopt-'))
  roots.push(home)
  const transcript = join(
    home,
    '.gemini',
    'antigravity-cli',
    'brain',
    CONVERSATION_ID,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  )
  await mkdir(dirname(transcript), { recursive: true })
  await writeFile(transcript, '')
  return { home, transcript }
}

function accountHome(home: string) {
  return {
    kind: 'antigravity' as const,
    locator: {
      home,
      credentialStore: 'file' as const,
      issuer: 'https://accounts.google.com' as const,
      subject: 'subject-1',
      authMethod: 'oauth'
    }
  }
}

beforeEach(() => {
  vi.mocked(getPtyIdForPaneKey).mockReturnValue(undefined)
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Antigravity adoption admission', () => {
  it('finds the conversation transcript under the selected account home', async () => {
    const { home, transcript } = await antigravityHome()
    await expect(
      resolveAntigravityStructuredAgentSessionAdoptionForCreate({
        host: null,
        providerSessionId: CONVERSATION_ID,
        selfSessionId: SELF_SESSION_ID,
        selectedAccountHome: accountHome(home),
        providerSessionRows: []
      })
    ).resolves.toEqual({ transcriptPath: transcript })
  })

  it('refuses while a live terminal pane still reports the same conversation', async () => {
    const { home } = await antigravityHome()
    vi.mocked(getPtyIdForPaneKey).mockReturnValue('pty-live')
    await expect(
      resolveAntigravityStructuredAgentSessionAdoptionForCreate({
        host: null,
        providerSessionId: CONVERSATION_ID,
        selfSessionId: SELF_SESSION_ID,
        selectedAccountHome: accountHome(home),
        providerSessionRows: [{ paneKey: 'tab-1:leaf-1', providerSession: { id: CONVERSATION_ID } }]
      })
    ).rejects.toThrow()
  })

  it('does not refuse for a pane that holds a different conversation', async () => {
    const { home, transcript } = await antigravityHome()
    vi.mocked(getPtyIdForPaneKey).mockReturnValue('pty-other')
    await expect(
      resolveAntigravityStructuredAgentSessionAdoptionForCreate({
        host: null,
        providerSessionId: CONVERSATION_ID,
        selfSessionId: SELF_SESSION_ID,
        selectedAccountHome: accountHome(home),
        providerSessionRows: [
          { paneKey: 'tab-1:leaf-1', providerSession: { id: 'some-other-conversation' } }
        ]
      })
    ).resolves.toEqual({ transcriptPath: transcript })
  })

  it('refuses when the account home does not hold the conversation', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'orca-antigravity-empty-'))
    roots.push(empty)
    await expect(
      resolveAntigravityStructuredAgentSessionAdoptionForCreate({
        host: null,
        providerSessionId: CONVERSATION_ID,
        selfSessionId: SELF_SESSION_ID,
        selectedAccountHome: accountHome(empty),
        providerSessionRows: []
      })
    ).rejects.toThrow()
  })

  it('refuses an Antigravity resume pinned to a legacy account home', async () => {
    await expect(
      resolveResumeFromAdoptionForCreate({
        host: null,
        settings: {},
        agent: 'antigravity',
        providerSessionId: CONVERSATION_ID,
        selfSessionId: SELF_SESSION_ID,
        selectedAccountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/dev/.claude' },
        providerSessionRows: []
      })
    ).rejects.toThrow()
  })
})
