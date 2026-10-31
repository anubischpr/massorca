import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SyncDatabase from '../sqlite/sync-database'
import {
  antigravityWorkspaceFromUris,
  readLocalAntigravityConversationIndex
} from './session-scanner-antigravity-conversation-db'
import { createAntigravityWorkspaceResolver } from './session-scanner-antigravity-history'
import { parseAntigravitySessionContent } from './session-scanner-antigravity-parser'
import { jsonLines } from './session-scanner-test-fixtures'
import { isAiVaultAutomatedRun } from '../../shared/ai-vault-automated-run'

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

// The columns the CLI writes for sub-agents, as read from a preview host's database.
function writeSubagentConversationDb(
  dbPath: string,
  rows: [conversationId: string, parentConversationId: string, nestingDepth: number][]
): void {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new SyncDatabase(dbPath)
  try {
    db.exec(
      `CREATE TABLE conversation_summaries (conversation_id TEXT NOT NULL, workspace_uris TEXT NOT NULL, parent_conversation_id TEXT NOT NULL DEFAULT '', nesting_depth INTEGER NOT NULL DEFAULT 0)`
    )
    const insert = db.prepare(
      'INSERT INTO conversation_summaries (conversation_id, workspace_uris, parent_conversation_id, nesting_depth) VALUES (?, ?, ?, ?)'
    )
    for (const [id, parent, depth] of rows) {
      insert.run(id, JSON.stringify(HOST_PARENT_URIS), parent, depth)
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

// Shapes read from a preview host's conversation_summaries.db: Orca's folders first, the worktree,
// then the shared design system folder Orca grants a linked worktree's chat.
const HOST_PROFILE = 'file:///home/ada/orca-preview/profile'
const HOST_WORKTREE_PATH = '/home/ada/orca/workspaces/NexusCare/elkhorn'
const HOST_PARENT_URIS = [
  `${HOST_PROFILE}/delegation-instructions`,
  `${HOST_PROFILE}/native-chat-visuals/073948329eae4e21cec1720836da394d`,
  `file://${HOST_WORKTREE_PATH}`,
  'file:///home/ada/projects/NexusCare/design/system'
]

describe('antigravityWorkspaceFromUris', () => {
  it('skips the shared design system folder that follows the worktree', () => {
    expect(antigravityWorkspaceFromUris(JSON.stringify(HOST_PARENT_URIS))).toBe(HOST_WORKTREE_PATH)
  })

  it('skips a Windows design system folder and keeps the worktree', () => {
    const value = JSON.stringify([WORKTREE_URI, 'file:///D:/projects/massorca/design/system'])

    expect(antigravityWorkspaceFromUris(value)).toBe(WORKTREE_PATH)
  })

  it('returns null when only the design system folder remains', () => {
    expect(
      antigravityWorkspaceFromUris(
        JSON.stringify(['file:///home/ada/projects/NexusCare/design/system'])
      )
    ).toBeNull()
  })

  it('keeps a worktree that merely contains a design folder', () => {
    expect(
      antigravityWorkspaceFromUris(JSON.stringify(['file:///home/ada/design/system-ui']))
    ).toBe('/home/ada/design/system-ui')
  })

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

describe('readLocalAntigravityConversationIndex', () => {
  it("reads each conversation's own worktree from the root database", async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['parent-conv', JSON.stringify([ORCA_DELEGATION_FOLDER, ORCA_VISUALS_FOLDER, WORKTREE_URI])],
      ['internal-conv', JSON.stringify([WORKTREE_URI])]
    ])

    const workspaces = (await readLocalAntigravityConversationIndex(join(root, 'history.jsonl')))
      ?.workspaces

    expect(workspaces).toEqual(
      new Map([
        ['parent-conv', WORKTREE_PATH],
        ['internal-conv', WORKTREE_PATH]
      ])
    )
  })

  it('keeps a parent and its native children in their worktree despite the design system folder', async () => {
    const root = makeRoot()
    const uris = JSON.stringify(HOST_PARENT_URIS)
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['df145e48-c555-439b-b056-c9c8f95e3d92', uris],
      ['9766d644-11ea-415e-bdbe-72961bf982cc', uris],
      ['c0b35b2a-db8c-41e2-bac5-7b142507ce5f', JSON.stringify([`file://${HOST_WORKTREE_PATH}`])]
    ])

    const workspaces = (await readLocalAntigravityConversationIndex(join(root, 'history.jsonl')))
      ?.workspaces

    expect([...(workspaces?.values() ?? [])]).toEqual([
      HOST_WORKTREE_PATH,
      HOST_WORKTREE_PATH,
      HOST_WORKTREE_PATH
    ])
  })

  it('falls back to a database under cache/', async () => {
    const root = makeRoot()
    writeConversationDb(
      join(root, 'cache', 'conversation_summaries.db'),
      'conversation_summaries',
      [['parent-conv', JSON.stringify([WORKTREE_URI])]]
    )

    const workspaces = (await readLocalAntigravityConversationIndex(join(root, 'history.jsonl')))
      ?.workspaces

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

    const workspaces = (await readLocalAntigravityConversationIndex(join(root, 'history.jsonl')))
      ?.workspaces

    expect(workspaces?.get('parent-conv')).toBe(WORKTREE_PATH)
  })

  it('omits a conversation whose rows name different worktrees', async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['shared-conv', JSON.stringify([WORKTREE_URI])],
      ['shared-conv', JSON.stringify(['file:///D:/projects/other-worktree'])]
    ])

    const workspaces = (await readLocalAntigravityConversationIndex(join(root, 'history.jsonl')))
      ?.workspaces

    expect(workspaces?.has('shared-conv')).toBe(false)
  })

  it('returns null when no database exists', async () => {
    const root = makeRoot()

    expect(await readLocalAntigravityConversationIndex(join(root, 'history.jsonl'))).toBeNull()
  })

  it('does not open a database over a WSL share', async () => {
    expect(
      await readLocalAntigravityConversationIndex(
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
    const resolver = createAntigravityWorkspaceResolver(readHistory, async () => ({
      workspaces: new Map([
        ['parent-conv', WORKTREE_PATH],
        ['internal-conv', WORKTREE_PATH]
      ]),
      subagentIds: new Set<string>()
    }))

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
    const resolver = createAntigravityWorkspaceResolver(readHistory, async () => ({
      workspaces: new Map([['parent-conv', WORKTREE_PATH]]),
      subagentIds: new Set<string>()
    }))

    expect((await resolver.enrich(internal, historyPath)).cwd).toBe(WORKTREE_PATH)
  })
})

describe('antigravity sub-agent conversations', () => {
  it('flags a conversation that has a parent or a nesting depth, and no other', async () => {
    const root = makeRoot()
    writeSubagentConversationDb(join(root, 'conversation_summaries.db'), [
      ['26354bb4-parent', '', 0],
      ['24815a37-worker', '26354bb4-parent', 1],
      ['64f3601b-depth-only', '', 1]
    ])

    const index = await readLocalAntigravityConversationIndex(join(root, 'history.jsonl'))

    expect([...(index?.subagentIds ?? [])]).toEqual(['24815a37-worker', '64f3601b-depth-only'])
    expect(index?.workspaces.get('24815a37-worker')).toBe(HOST_WORKTREE_PATH)
  })

  it('reads a table without the sub-agent columns and flags nothing', async () => {
    const root = makeRoot()
    writeConversationDb(join(root, 'conversation_summaries.db'), 'conversation_summaries', [
      ['parent-conv', JSON.stringify([WORKTREE_URI])]
    ])

    const index = await readLocalAntigravityConversationIndex(join(root, 'history.jsonl'))

    expect(index?.subagentIds.size).toBe(0)
    expect(index?.workspaces.get('parent-conv')).toBe(WORKTREE_PATH)
  })

  it('marks the sub-agent headless, keeps its worktree, and leaves the parent a chat', async () => {
    const worker = await parseConversation('24815a37-worker', 'ignored')
    const parent = await parseConversation('26354bb4-parent', 'Improve the explorer')
    const resolver = createAntigravityWorkspaceResolver(
      async () => null,
      async () => ({
        workspaces: new Map([
          ['24815a37-worker', WORKTREE_PATH],
          ['26354bb4-parent', WORKTREE_PATH]
        ]),
        subagentIds: new Set(['24815a37-worker'])
      })
    )

    const enrichedWorker = await resolver.enrich(worker, historyPath)
    const enrichedParent = await resolver.enrich(parent, historyPath)

    expect(enrichedWorker.headlessRun).toBe(true)
    expect(enrichedWorker.cwd).toBe(WORKTREE_PATH)
    expect(enrichedParent.headlessRun).toBeUndefined()
    expect(isAiVaultAutomatedRun(enrichedWorker)).toBe(true)
    expect(isAiVaultAutomatedRun(enrichedParent)).toBe(false)
  })

  it('marks a sub-agent that already has a cwd', async () => {
    const worker = { ...(await parseConversation('24815a37-worker', 'x')), cwd: WORKTREE_PATH }
    const resolver = createAntigravityWorkspaceResolver(
      async () => null,
      async () => ({ workspaces: new Map(), subagentIds: new Set(['24815a37-worker']) })
    )

    expect((await resolver.enrich(worker, historyPath)).headlessRun).toBe(true)
  })
})
