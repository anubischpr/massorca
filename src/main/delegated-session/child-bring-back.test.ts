import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitCapabilityCache } from '../../shared/git-capability-cache'
import { childBringBackView } from '../../shared/child-bring-back'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { ChildBringBackService, type ChildBringBackGit } from './child-bring-back'

const exec = promisify(execFile)

let root: string
let parent: string
let child: string
let row: DelegationRequestRow
let working: Set<string>
let workspaces: Map<string, string>
let removedChild: boolean
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
    run: async (args) => (await exec('git', args, { cwd })).stdout,
    capabilities: new GitCapabilityCache()
  }
}

function service(): ChildBringBackService {
  return new ChildBringBackService({
    readRequest: () => row,
    readWorkspaceId: (sessionId) => workspaces.get(sessionId) ?? null,
    isSessionWorking: async (sessionId) => working.has(sessionId),
    gitIn: async (workspaceId) => {
      if (workspaceId === 'child-wt' && removedChild) {
        return null
      }
      return gitIn(workspaceId === 'parent-wt' ? parent : child)
    },
    tellParent,
    warn: () => undefined
  })
}

function storeChildGit(baseSha: string): void {
  row.options_json = JSON.stringify({
    agents: [],
    childGit: { branch: 'child', baseSha }
  })
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'bring-back-'))
  parent = join(root, 'parent')
  child = join(root, 'child')
  await exec('git', ['init', '-q', '-b', 'main', parent])
  await git(parent, 'config', 'user.email', 'test@example.com')
  await git(parent, 'config', 'user.name', 'Test')
  await commit(parent, 'base.txt', 'base\n')
  await git(parent, 'worktree', 'add', '-q', '-b', 'child', child)
  working = new Set()
  removedChild = false
  workspaces = new Map([
    ['parent-session', 'parent-wt'],
    ['child-session', 'child-wt']
  ])
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
    options_json: '{"agents":[]}',
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
  storeChildGit(await git(child, 'rev-parse', 'HEAD'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('child bring back status', () => {
  it('counts commits and files from a child with commits and a clean tree', async () => {
    await commit(child, 'a.txt', 'a\n')
    await commit(child, 'b.txt', 'b\n')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'ready',
      commits: 2,
      files: 2,
      into: 'main',
      parentAhead: 0,
      childUncommitted: 0,
      block: null
    })
  })

  it('says a child that committed nothing has nothing to bring back', async () => {
    writeFileSync(join(child, 'draft.txt'), 'draft\n')
    expect(await service().status('deleg_1')).toEqual({
      kind: 'nothing',
      childUncommitted: 1
    })
  })

  it('reports uncommitted child files beside its commits', async () => {
    await commit(child, 'a.txt', 'a\n')
    writeFileSync(join(child, 'draft.txt'), 'draft\n')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'ready',
      childUncommitted: 1
    })
  })

  it('reports a parent that moved ahead', async () => {
    await commit(child, 'a.txt', 'a\n')
    await commit(parent, 'p.txt', 'p\n')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'ready',
      parentAhead: 1
    })
  })

  it('blocks on uncommitted parent work and leaves it untouched', async () => {
    await commit(child, 'a.txt', 'a\n')
    writeFileSync(join(parent, 'base.txt'), 'mine\n')
    const status = await service().bringBack('deleg_1')
    expect(status).toMatchObject({
      kind: 'ready',
      block: 'parent-uncommitted',
      parentUncommitted: 1
    })
    expect(await git(parent, 'status', '--porcelain')).toBe('M base.txt')
    expect(await git(parent, 'log', '--oneline', '--merges')).toBe('')
  })

  it('blocks while the parent session works', async () => {
    await commit(child, 'a.txt', 'a\n')
    working.add('parent-session')
    expect(await service().status('deleg_1')).toMatchObject({
      block: 'parent-working'
    })
  })

  it('blocks on a detached parent', async () => {
    await commit(child, 'a.txt', 'a\n')
    await git(parent, 'checkout', '-q', '--detach')
    expect(await service().status('deleg_1')).toMatchObject({
      block: 'parent-no-branch'
    })
  })

  it('reads a child that resumed as running', async () => {
    working.add('child-session')
    expect(await service().status('deleg_1')).toEqual({ kind: 'running' })
    row.status = 'started'
    working.clear()
    expect(await service().status('deleg_1')).toEqual({ kind: 'running' })
  })

  it('offers a removed worktree while its branch lives, then reads it gone', async () => {
    await commit(child, 'a.txt', 'a\n')
    await git(parent, 'worktree', 'remove', '--force', child)
    removedChild = true
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'ready',
      commits: 1,
      childWorktreeRemoved: true
    })
    await git(parent, 'branch', '-D', 'child')
    expect(await service().status('deleg_1')).toEqual({ kind: 'gone' })
  })

  it('offers nothing for a folder workspace or a child in the parent worktree', async () => {
    row.workspace_kind = 'folder'
    expect(await service().status('deleg_1')).toEqual({ kind: 'unavailable' })
    row.workspace_kind = 'git'
    workspaces.set('child-session', 'parent-wt')
    expect(await service().status('deleg_1')).toEqual({ kind: 'unavailable' })
  })

  it('needs no stored identity on an older request while the worktree lives', async () => {
    row.options_json = '{"agents":[]}'
    await commit(child, 'a.txt', 'a\n')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'ready',
      commits: 1
    })
  })
})

describe('child bring back merge', () => {
  it('merges with a merge commit, keeps the child commits, and reads as brought back', async () => {
    await commit(child, 'a.txt', 'a\n')
    const childHead = await git(child, 'rev-parse', 'HEAD')
    const status = await service().bringBack('deleg_1')
    const head = await git(parent, 'rev-parse', '--short', 'HEAD')
    expect(status).toEqual({
      kind: 'brought-back',
      into: 'main',
      commit: head
    })
    expect(await git(parent, 'rev-parse', 'HEAD^2')).toBe(childHead)
    expect(await git(parent, 'log', '-1', '--format=%s')).toBe('Merge child session "Upload retry"')
    expect(await service().bringBack('deleg_1')).toEqual(status)
    expect(await git(parent, 'rev-list', '--count', '--merges', 'HEAD')).toBe('1')
  })

  it('reads a manual merge as brought back too', async () => {
    await commit(child, 'a.txt', 'a\n')
    await git(parent, 'merge', '--no-ff', '-m', 'by hand', 'child')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'brought-back'
    })
  })

  it('leaves uncommitted child files in the child', async () => {
    await commit(child, 'a.txt', 'a\n')
    writeFileSync(join(child, 'draft.txt'), 'draft\n')
    await service().bringBack('deleg_1')
    expect(await git(child, 'status', '--porcelain')).toBe('?? draft.txt')
  })

  it('stops on conflicts, and abort restores the parent exactly', async () => {
    await commit(child, 'base.txt', 'child\n')
    await commit(parent, 'base.txt', 'parent\n')
    const before = await git(parent, 'rev-parse', 'HEAD')
    expect(await service().bringBack('deleg_1')).toEqual({
      kind: 'conflicts',
      unresolved: 1
    })
    await service().resolveWithAgent('deleg_1')
    expect(tellParent).toHaveBeenCalledWith(
      'parent-session',
      expect.stringContaining('Upload retry')
    )
    expect(await service().abort('deleg_1')).toMatchObject({ kind: 'ready' })
    expect(await git(parent, 'rev-parse', 'HEAD')).toBe(before)
    expect(await git(parent, 'status', '--porcelain')).toBe('')
  })

  it('reads as brought back once a person finishes the conflicted merge', async () => {
    await commit(child, 'base.txt', 'child\n')
    await commit(parent, 'base.txt', 'parent\n')
    await service().bringBack('deleg_1')
    writeFileSync(join(parent, 'base.txt'), 'both\n')
    await git(parent, 'add', 'base.txt')
    await git(parent, 'commit', '--no-edit')
    expect(await service().status('deleg_1')).toMatchObject({
      kind: 'brought-back'
    })
  })

  it('never aborts another merge running in the parent', async () => {
    await commit(child, 'a.txt', 'a\n')
    await git(parent, 'checkout', '-q', '-b', 'other')
    await commit(parent, 'base.txt', 'other\n')
    await git(parent, 'checkout', '-q', 'main')
    await commit(parent, 'base.txt', 'main\n')
    await git(parent, 'merge', 'other').catch(() => undefined)
    expect(await service().abort('deleg_1')).toMatchObject({
      block: 'parent-no-branch'
    })
    expect(await git(parent, 'rev-parse', '--verify', 'MERGE_HEAD')).not.toBe('')
  })

  it('predicts conflicts where Git can, and otherwise stays silent', async () => {
    await commit(child, 'base.txt', 'child\n')
    await commit(parent, 'base.txt', 'parent\n')
    const status = await service().status('deleg_1')
    expect(status).toMatchObject({ kind: 'ready' })
    if (status.kind === 'ready' && status.predictedConflicts !== null) {
      expect(status.predictedConflicts).toBe(1)
    }
  })
})

describe('childBringBackView', () => {
  it('keeps the approved words', () => {
    const view = childBringBackView({
      kind: 'ready',
      commits: 3,
      files: 12,
      into: 'feature/uploads',
      parentAhead: 4,
      childUncommitted: 2,
      childWorktreeRemoved: false,
      predictedConflicts: 2,
      block: null,
      parentUncommitted: 0
    })
    expect(view.meta.map((line) => line.template)).toEqual([
      '{{count}} commits',
      '{{count}} files',
      'into {{into}}',
      'parent has {{count}} new commits'
    ])
    expect(view.warnings.map((line) => line.template)).toEqual([
      '{{count}} uncommitted files stay in the child.',
      'Will conflict in {{count}} files. You can abort.'
    ])
    expect(view.action).toEqual({ enabled: true })
  })
})
