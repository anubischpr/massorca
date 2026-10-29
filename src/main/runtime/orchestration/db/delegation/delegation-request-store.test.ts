import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import Database from '../../../../sqlite/sync-database'
import { OrchestrationDb } from '../orchestration-db'
import { SCHEMA_VERSION } from '../contract-constants'

const FILED = {
  parentSessionId: 'session_parent_01',
  title: 'Audit the parser',
  summary: 'Read only audit of the parser',
  prompt: 'Read src/parser and list the unsafe casts.',
  writes: false,
  workspaceKind: 'git' as const,
  optionsJson: JSON.stringify({ agents: [{ agent: 'claude', label: 'Claude' }] }),
  decisionJson: null
}

describe('delegation request store', () => {
  let db: OrchestrationDb | undefined
  let tempDir: string | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      tempDir = undefined
    }
  })

  it('files a pending request with the columns the card was built from', () => {
    db = new OrchestrationDb(':memory:')
    const row = db.createDelegationRequest(FILED)

    expect(row).toMatchObject({
      parent_session_id: FILED.parentSessionId,
      title: FILED.title,
      prompt: FILED.prompt,
      writes: 0,
      workspace_kind: 'git',
      status: 'pending',
      choice: null,
      dispatch_id: null
    })
    expect(row.id).toMatch(/^deleg_[0-9a-f]{12}$/)
    expect(db.getDelegationRequest(row.id)).toEqual(row)
  })

  it('moves a request one step at a time, so a second claimant loses', () => {
    db = new OrchestrationDb(':memory:')
    const { id } = db.createDelegationRequest(FILED)

    const first = db.transitionDelegationRequest(id, 'pending', 'starting', { choice: 'automatic' })
    const second = db.transitionDelegationRequest(id, 'pending', 'starting', {
      choice: 'agent:codex'
    })

    expect(first).toMatchObject({ status: 'starting', choice: 'automatic' })
    expect(second).toBeNull()
    expect(db.getDelegationRequest(id)?.choice).toBe('automatic')
  })

  it('refuses a column outside the ones a request writes later', () => {
    db = new OrchestrationDb(':memory:')
    const { id } = db.createDelegationRequest(FILED)

    expect(() =>
      db?.transitionDelegationRequest(id, 'pending', 'starting', {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the test forces the runtime guard with a column the type forbids.
        ...({ prompt: 'rewritten' } as Record<string, string>)
      })
    ).toThrow('Unsupported delegation request column')
  })

  it('finds a request by the dispatch that runs its child', () => {
    db = new OrchestrationDb(':memory:')
    const { id } = db.createDelegationRequest(FILED)
    db.patchDelegationRequest(id, {
      dispatch_id: 'dispatch_a1',
      child_session_id: 'session_child_1'
    })

    expect(db.getDelegationRequestByDispatch('dispatch_a1')?.id).toBe(id)
    expect(db.getDelegationRequestByDispatch('dispatch_none')).toBeUndefined()
  })

  it('lists requests by status', () => {
    db = new OrchestrationDb(':memory:')
    const a = db.createDelegationRequest(FILED)
    const b = db.createDelegationRequest(FILED)
    db.transitionDelegationRequest(b.id, 'pending', 'starting')

    expect(db.listDelegationRequestsByStatus('pending').map((row) => row.id)).toEqual([a.id])
    expect(db.listDelegationRequestsByStatus('starting').map((row) => row.id)).toEqual([b.id])
  })

  it('keeps a request across a host restart', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'orca-delegation-store-'))
    const path = join(tempDir, 'orchestration.db')
    const first = new OrchestrationDb(path)
    const { id } = first.createDelegationRequest(FILED)
    first.transitionDelegationRequest(id, 'pending', 'starting', { choice: 'agent:claude' })
    first.close()

    db = new OrchestrationDb(path)

    expect(db.getDelegationRequest(id)).toMatchObject({
      status: 'starting',
      choice: 'agent:claude'
    })
  })

  it('adds the table to a database an earlier build created', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'orca-delegation-upgrade-'))
    const path = join(tempDir, 'orchestration.db')
    new OrchestrationDb(path).close()
    const raw = new Database(path)
    raw.exec('DROP TABLE delegation_requests')
    raw.pragma(`user_version = ${SCHEMA_VERSION}`)
    raw.close()

    db = new OrchestrationDb(path)

    expect(db.createDelegationRequest(FILED).status).toBe('pending')
  })

  it('is cleared by a full reset and a task reset', () => {
    db = new OrchestrationDb(':memory:')
    const a = db.createDelegationRequest(FILED)
    db.resetTasks()
    expect(db.getDelegationRequest(a.id)).toBeUndefined()

    const b = db.createDelegationRequest(FILED)
    db.resetAll()
    expect(db.getDelegationRequest(b.id)).toBeUndefined()
  })

  it('lists a started child with its dispatch and task, and nothing else', () => {
    db = new OrchestrationDb(':memory:')
    const started = db.createDelegationRequest(FILED)
    db.transitionDelegationRequest(started.id, 'pending', 'starting')
    db.transitionDelegationRequest(started.id, 'starting', 'started', {
      run_id: 'run_a',
      task_id: 'task_a',
      dispatch_id: 'dispatch_a',
      child_session_id: 'session_child_a'
    })
    const unlinked = db.createDelegationRequest(FILED)
    db.transitionDelegationRequest(unlinked.id, 'pending', 'starting')
    db.transitionDelegationRequest(unlinked.id, 'starting', 'started', {
      run_id: 'run_a',
      task_id: 'task_b',
      dispatch_id: 'dispatch_b'
    })
    db.createDelegationRequest(FILED)

    expect(db.listDelegatedChildLinks(['session_child_a', FILED.parentSessionId])).toEqual([
      {
        child_session_id: 'session_child_a',
        parent_session_id: FILED.parentSessionId,
        run_id: 'run_a',
        task_id: 'task_a',
        dispatch_id: 'dispatch_a',
        dispatch_status: null,
        task_spec: null,
        task_title: null,
        display_name: null
      }
    ])
  })

  it('lists a link only when its child and its parent are both given', () => {
    db = new OrchestrationDb(':memory:')
    const { id } = db.createDelegationRequest(FILED)
    db.transitionDelegationRequest(id, 'pending', 'starting')
    db.transitionDelegationRequest(id, 'starting', 'started', {
      run_id: 'run_a',
      task_id: 'task_a',
      dispatch_id: 'dispatch_a',
      child_session_id: 'session_child_a'
    })

    expect(db.listDelegatedChildLinks(['session_child_a'])).toEqual([])
    expect(db.listDelegatedChildLinks([FILED.parentSessionId])).toEqual([])
    expect(db.listDelegatedChildLinks(['session_child_a', FILED.parentSessionId])).toHaveLength(1)
  })

  it('keeps a child link across a host restart', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'orca-delegation-link-'))
    const path = join(tempDir, 'orchestration.db')
    const first = new OrchestrationDb(path)
    const { id } = first.createDelegationRequest(FILED)
    first.transitionDelegationRequest(id, 'pending', 'starting')
    first.transitionDelegationRequest(id, 'starting', 'started', {
      run_id: 'run_a',
      task_id: 'task_a',
      dispatch_id: 'dispatch_a',
      child_session_id: 'session_child_a'
    })
    first.close()

    db = new OrchestrationDb(path)

    expect(
      db
        .listDelegatedChildLinks(['session_child_a', FILED.parentSessionId])
        .map((link) => link.child_session_id)
    ).toEqual(['session_child_a'])
  })
})
