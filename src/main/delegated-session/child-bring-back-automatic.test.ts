import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { childBringBackView, type ChildBringBackPolicy } from '../../shared/child-bring-back'
import { GitCapabilityCache } from '../../shared/git-capability-cache'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { ChildBringBackService, type ChildBringBackGit } from './child-bring-back'
import { ChildBringBackAutomatic, childBringBackPolicyOf } from './child-bring-back-automatic'
import { storedOptionsWithAutomaticBringBack } from './delegation-stored-request'

const exec = promisify(execFile)

let root: string
let parent: string
let child: string
let row: DelegationRequestRow
let working: Set<string>
let policy: ChildBringBackPolicy
let oldGit: boolean
const tellParent = vi.fn()

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await exec('git', args, { cwd })).stdout.trim()
}

async function commit(cwd: string, file: string, text: string): Promise<void> {
  writeFileSync(join(cwd, file), text)
  await git(cwd, 'add', file)
  await git(cwd, 'commit', '-m', `change ${file}`)
}

function gitIn(cwd: string): ChildBringBackGit {
  return {
    run: async (args) => {
      if (oldGit && args[0] === 'merge-tree') {
        throw Object.assign(new Error('unknown option'), {
          stderr: "error: unknown option `write-tree'"
        })
      }
      return (await exec('git', args, { cwd })).stdout
    },
    capabilities: new GitCapabilityCache()
  }
}

function automatic(): { automatic: ChildBringBackAutomatic; service: ChildBringBackService } {
  const service = new ChildBringBackService({
    readRequest: () => row,
    readWorkspaceId: (id) => (id === 'parent-session' ? 'parent-wt' : 'child-wt'),
    isSessionWorking: async (id) => working.has(id),
    gitIn: async (id) => gitIn(id === 'parent-wt' ? parent : child),
    tellParent,
    warn: () => undefined
  })
  return {
    service,
    automatic: new ChildBringBackAutomatic({
      service,
      readRequest: () => row,
      listFinishedRequests: () => [row],
      readWorkspaceId: (id) => (id === 'parent-session' ? 'parent-wt' : 'child-wt'),
      readPolicy: () => policy,
      mark: (_, mark) => {
        row.options_json = storedOptionsWithAutomaticBringBack(row, mark)
      },
      tellParent,
      warn: () => undefined
    })
  }
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'bring-back-auto-'))
  parent = join(root, 'parent')
  child = join(root, 'child')
  await exec('git', ['init', '-q', '-b', 'main', parent])
  await git(parent, 'config', 'user.email', 'test@example.com')
  await git(parent, 'config', 'user.name', 'Test')
  await commit(parent, 'base.txt', 'base\n')
  await git(parent, 'worktree', 'add', '-q', '-b', 'child', child)
  await commit(child, 'child.txt', 'child\n')
  working = new Set()
  policy = 'auto'
  oldGit = false
  tellParent.mockReset()
  row = {
    id: 'deleg_1',
    run_id: null,
    parent_session_id: 'parent-session',
    title: 'Upload retry',
    summary: '',
    prompt: '',
    writes: 1,
    workspace_kind: 'git',
    options_json: JSON.stringify({ agents: [] }),
    decision_json: null,
    choice: null,
    status: 'finished',
    question_item_id: null,
    task_id: null,
    dispatch_id: null,
    child_session_id: 'child-session',
    result: null,
    failure: null,
    launched_at_ms: null,
    created_at: '',
    updated_at: ''
  }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const merged = (): boolean => existsSync(join(parent, 'child.txt'))

async function makeConflict(): Promise<void> {
  await commit(child, 'base.txt', 'child side\n')
  await commit(parent, 'base.txt', 'parent side\n')
}

describe('childBringBackPolicyOf', () => {
  it('maps each access to its policy, and an unresolved access to asking', () => {
    expect(childBringBackPolicyOf('full-access')).toBe('full')
    expect(childBringBackPolicyOf('auto')).toBe('auto')
    for (const access of ['default', 'accept-edits', 'plan', 'read-only', undefined] as const) {
      expect(childBringBackPolicyOf(access)).toBe('ask')
    }
  })
})

describe('ask policy', () => {
  it('never merges', async () => {
    policy = 'ask'
    await automatic().automatic.onChildFinished(row.id)
    expect(merged()).toBe(false)
    expect(tellParent).not.toHaveBeenCalled()
  })
})

describe('auto policy', () => {
  it('merges a clean finish and tells the parent what entered its tree', async () => {
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    expect(merged()).toBe(true)
    const status = await service.status(row.id)
    expect(childBringBackView(status).meta[0].template).toBe(
      'Brought back automatically into {{into}} · {{commit}}'
    )
    expect(tellParent).toHaveBeenCalledTimes(1)
    expect(tellParent.mock.calls[0][1]).toContain('Upload retry')
    expect(tellParent.mock.calls[0][1]).toContain('main')
  })

  it('asks when the parent has uncommitted work', async () => {
    writeFileSync(join(parent, 'base.txt'), 'dirty\n')
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    expect(merged()).toBe(false)
    expect(tellParent).not.toHaveBeenCalled()
    const view = childBringBackView(await service.status(row.id))
    expect(view.action).toEqual({ enabled: false })
    expect(view.warnings[0].id).toBe('parentUncommittedOne')
  })

  it('asks when the parent is working, and does not retry at its turn end', async () => {
    working.add('parent-session')
    const { automatic: auto } = automatic()
    await auto.onChildFinished(row.id)
    working.clear()
    await auto.onTurnEnded('parent-session')
    expect(merged()).toBe(false)
  })

  it('asks when a conflict is predicted, without touching the parent', async () => {
    await makeConflict()
    const { automatic: auto, service } = automatic()
    const before = await git(parent, 'rev-parse', 'HEAD')
    await auto.onChildFinished(row.id)
    expect(await git(parent, 'rev-parse', 'HEAD')).toBe(before)
    expect((await service.status(row.id)).kind).toBe('ready')
  })

  it('tries and undoes a conflict on Git without merge-tree --write-tree', async () => {
    oldGit = true
    await makeConflict()
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    expect(await git(parent, 'status', '--porcelain')).toBe('')
    const view = childBringBackView(await service.status(row.id))
    expect(view.warnings[0].template).toBe('Merging hit conflicts, so it was undone.')
    expect(view.action).toEqual({ enabled: true })
  })

  it('merges once the child that reported finishing ends its turn', async () => {
    working.add('child-session')
    const { automatic: auto } = automatic()
    await auto.onChildFinished(row.id)
    expect(merged()).toBe(false)
    working.clear()
    await auto.onTurnEnded('child-session')
    expect(merged()).toBe(true)
  })
})

describe('full policy', () => {
  beforeEach(() => {
    policy = 'full'
  })

  it('waits for the parent turn, then merges', async () => {
    working.add('parent-session')
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    expect(merged()).toBe(false)
    const view = childBringBackView(await service.status(row.id))
    expect(view.warnings[0].template).toBe('Will bring back when the parent session stops.')
    expect(view.action).toBeNull()
    working.clear()
    await auto.onTurnEnded('parent-session')
    expect(merged()).toBe(true)
  })

  it('asks the parent agent once to commit, keeps its work, and merges after it does', async () => {
    writeFileSync(join(parent, 'base.txt'), 'dirty\n')
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    await auto.onTurnEnded('parent-session')
    expect(tellParent).toHaveBeenCalledTimes(1)
    expect(await git(parent, 'status', '--porcelain')).toContain('base.txt')
    const view = childBringBackView(await service.status(row.id))
    expect(view.warnings[0].template).toBe('Asked the parent session to commit first.')
    await git(parent, 'commit', '-am', 'parent work')
    await auto.onTurnEnded('parent-session')
    expect(merged()).toBe(true)
  })

  it('leaves conflicts open for the parent agent and tells it', async () => {
    await makeConflict()
    const { automatic: auto, service } = automatic()
    await auto.onChildFinished(row.id)
    const view = childBringBackView(await service.status(row.id))
    expect(view.conflicts).toEqual({ unresolved: 1, agentResolving: true })
    expect(view.warnings[0].template).toBe('The parent session is resolving these.')
    expect(tellParent.mock.calls[0][1]).toContain('merge conflicts')
  })

  it('waits out a sibling child still merging, then merges', async () => {
    await git(parent, 'checkout', '-q', '-b', 'sibling')
    await commit(parent, 'base.txt', 'sibling side\n')
    await git(parent, 'checkout', '-q', 'main')
    await commit(parent, 'base.txt', 'parent side\n')
    await expect(git(parent, 'merge', 'sibling')).rejects.toThrow()
    const { automatic: auto } = automatic()
    await auto.onChildFinished(row.id)
    expect(merged()).toBe(false)
    writeFileSync(join(parent, 'base.txt'), 'both\n')
    await git(parent, 'add', 'base.txt')
    await git(parent, 'commit', '-q', '--no-edit')
    await auto.onTurnEnded('parent-session')
    expect(merged()).toBe(true)
  })

  it('does not merge an older finished request it was never waiting on', async () => {
    await automatic().automatic.onTurnEnded('parent-session')
    expect(merged()).toBe(false)
  })
})

describe('a child that finished with nothing to bring back', () => {
  it('stops waiting, so a later commit in the child is left for the person', async () => {
    policy = 'full'
    await git(child, 'reset', '-q', '--hard', 'HEAD~1')
    working.add('child-session')
    const { automatic: auto } = automatic()
    await auto.onChildFinished(row.id)
    expect(JSON.parse(row.options_json).automaticBringBack).toBe('child-finishing')
    working.clear()
    await auto.onTurnEnded('child-session')
    expect(JSON.parse(row.options_json).automaticBringBack).toBe('notice')
    await commit(child, 'child.txt', 'later\n')
    await auto.reconcile()
    await auto.onTurnEnded('child-session')
    expect(merged()).toBe(false)
    expect(tellParent).not.toHaveBeenCalled()
  })
})

describe('serial merges', () => {
  it('runs attempts for one parent worktree one at a time', async () => {
    const { automatic: auto } = automatic()
    await Promise.all([auto.onChildFinished(row.id), auto.onChildFinished(row.id)])
    expect(tellParent).toHaveBeenCalledTimes(1)
  })
})
