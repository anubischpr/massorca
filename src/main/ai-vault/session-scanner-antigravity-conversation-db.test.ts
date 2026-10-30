import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SyncDatabase from '../sqlite/sync-database'
import {
  antigravityWorkspaceFromUris,
  readLocalAntigravityConversationWorkspaces
} from './session-scanner-antigravity-conversation-db'
import { createAntigravityWorkspaceResolver } from './session-scanner-antigravity-history'
import { parseAntigravitySessionContent } from './session-scanner-antigravity-parser'
import { jsonLines } from './session-scanner-test-fixtures'

const ORCA_DELEGATION_FOLDER =
  'file:///C:/Users/ada/AppData/Roaming/orca/profile/delegation-instructions'
const ORCA_VISUALS_FOLDER =
  'file:///C:/Users/ada/AppData/Roaming/orca/profile/native-chat-visuals/abc123'
const WORKTREE_URI = 'file:///D:/projects/massorca/.claude/worktrees/feature-x'
const WORKTREE_PATH = 'D:/projects/massorca/.claude/worktrees/feature-x'
const openingTime = '2026-07-15T11:39:10.000Z'
const historyPath = '/home/ada/.gemini/antigravity-cli/history.jsonl'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'antigravity-conversation-db-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeConversationDb(
  dbPath: string,
  tableName: string,
  rows: [conversationId: string, workspaceUris: string][]
): void {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new SyncDatabase(dbPath)
  try {
    db.exec(
      `CREATE TABLE ${tableName} (conversation_id TEXT NOT NULL, workspace_uris TEXT NOT NULL)`
    )
    const insert = db.prepare(
      `INSERT INTO ${tableName} (conversation_id, workspace_uris) VALUES (?, ?)`
    )
    for (const [conversationId, workspaceUris] of rows) {
      insert.run(conversationId, workspaceUris)
    }
  } finally {
    db.close()
  }
}

async function parseConversation(conversationId: string, prompt: string) {
  const file = {
    path: `/home/ada/.gemini/antigravity-cli/brain/${conversationId}/.system_generated/logs/transcript.jsonl`,
    mtimeMs: Date.parse(openingTime),
    modifiedAt: openingTime
  }
  const session = await parseAntigravitySessionContent(
    file,
    jsonLines([
      {
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        created_at: openingTime,
        content: `<USER_REQUEST>${prompt}</USER_REQUEST>`
      }
    ]),
    'linux'
  )
  if (!session) {
    throw new Error('Missing parsed fixture session')
  }
  return session
}

describe('antigravityWorkspaceFromUris', () => {
  it('keeps the worktree listed after Orca folders', () => {
    const value = JSON.stringify([ORCA_DELEGATION_FOLDER, ORCA_VISUALS_FOLDER, WORKTREE_URI])

    expect(antigravityWorkspaceFromUris(value)).toBe(WORKTREE_PATH)
  })

  it('takes the only entry of a print-mode run', () => {
    expect(antigravityWorkspaceFromUris(JSON.stringify([WORKTREE_URI]))).toBe(WORKTREE_PATH)
  })

  it('returns null when only Orca folders are listed', () => {
    expect(
      antigravityWorkspaceFromUris(JSON.stringify([ORCA_DELEGATION_FOLDER, ORCA_VISUALS_FOLDER]))
    ).toBeNull()
  })

  it('decodes percent-encoded file URIs and accepts a plain absolute path', () => {
    expect(antigravityWorkspaceFromUris('file:///home/ada/my%20repo')).toBe('/home/ada/my repo')
    expect(antigravityWorkspaceFromUris('/home/ada/repo')).toBe('/home/ada/repo')
  })

  it('ignores values that are neither file URIs nor absolute paths', () => {
    expect(antigravityWorkspaceFromUris(null)).toBeNull()
    expect(antigravityWorkspaceFromUris('not a path')).toBeNull()
  })
})

describe('readLocalAntigravityConversationWorkspaces', () => {
  it("reads each conversation's own worktree from the root database", async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['parent-conv', JSON.stringify([ORCA_DELEGATION_FOLDER, ORCA_VISUALS_FOLDER, WORKTREE_URI])],
      ['internal-conv', JSON.stringify([WORKTREE_URI])]
    ])

    const workspaces = await readLocalAntigravityConversationWorkspaces(join(root, 'history.jsonl'))

    expect(workspaces).toEqual(
      new Map([
        ['parent-conv', WORKTREE_PATH],
        ['internal-conv', WORKTREE_PATH]
      ])
    )
  })

  it('falls back to a database under cache/', async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'cache', 'conversation_summaries.db'), 'conversation_summaries', [
      ['parent-conv', JSON.stringify([WORKTREE_URI])]
    ])

    const workspaces = await readLocalAntigravityConversationWorkspaces(join(root, 'history.jsonl'))

    expect(workspaces?.get('parent-conv')).toBe(WORKTREE_PATH)
  })

  it('finds the conversation table by its columns, whatever it is named', async () => {
    const root = makeRoot()
    const dbPath = join(root, 'conversation_summaries.db')
    writeConversationDb(dbPath, 'summary_index', [['parent-conv', JSON.stringify([WORKTREE_URI])]])
    const db = new SyncDatabase(dbPath)
    try {
      db.exec('CREATE TABLE unrelated (id TEXT NOT NULL)')
    } finally {
      db.close()
    }

    const workspaces = await readLocalAntigravityConversationWorkspaces(join(root, 'history.jsonl'))

    expect(workspaces?.get('parent-conv')).toBe(WORKTREE_PATH)
  })

  it('omits a conversation whose rows name different worktrees', async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['shared-conv', JSON.stringify([WORKTREE_URI])],
      ['shared-conv', JSON.stringify(['file:///D:/projects/other-worktree'])]
    ])

    const workspaces = await readLocalAntigravityConversationWorkspaces(join(root, 'history.jsonl'))

    expect(workspaces?.has('shared-conv')).toBe(false)
  })

  it('returns null when no database exists', async () => {
    const root = makeRoot()

    expect(await readLocalAntigravityConversationWorkspaces(join(root, 'history.jsonl'))).toBeNull()
  })

  it('does not open a database over a WSL share', async () => {
    expect(
      await readLocalAntigravityConversationWorkspaces(
        '\\\\wsl$\\Ubuntu\\home\\ada\\.gemini\\antigravity-cli\\history.jsonl'
      )
    ).toBeNull()
  })
})

describe('antigravity workspace resolution with the conversation database', () => {
  it('keeps the parent worktree after an internal run replaces the cache entry', async () => {
    const parent = await parseConversation('parent-conv', 'Improve the explorer')
    const readHistory = async (path: string) =>
      path.endsWith('last_conversations.json')
        ? JSON.stringify({ [WORKTREE_PATH]: 'internal-conv' })
        : null
    const resolver = createAntigravityWorkspaceResolver(
      readHistory,
      async () =>
        new Map([
          ['parent-conv', WORKTREE_PATH],
          ['internal-conv', WORKTREE_PATH]
        ])
    )

    expect(parent.sessionId).toBe('parent-conv')
    expect((await resolver.enrich(parent, historyPath)).cwd).toBe(WORKTREE_PATH)
  })

  it('cannot recover the parent from the cache file alone', async () => {
    const parent = await parseConversation('parent-conv', 'Improve the explorer')
    const readHistory = async (path: string) =>
      path.endsWith('last_conversations.json')
        ? JSON.stringify({ [WORKTREE_PATH]: 'internal-conv' })
        : null
    const resolver = createAntigravityWorkspaceResolver(readHistory)

    expect((await resolver.enrich(parent, historyPath)).cwd ?? null).toBeNull()
  })

  it('keeps the cache file for a conversation the database does not name', async () => {
    const internal = await parseConversation('internal-conv', 'Predict the next message')
    const readHistory = async (path: string) =>
      path.endsWith('last_conversations.json')
        ? JSON.stringify({ [WORKTREE_PATH]: 'internal-conv' })
        : null
    const resolver = createAntigravityWorkspaceResolver(
      readHistory,
      async () => new Map([['parent-conv', WORKTREE_PATH]])
    )

    expect((await resolver.enrich(internal, historyPath)).cwd).toBe(WORKTREE_PATH)
  })
})
