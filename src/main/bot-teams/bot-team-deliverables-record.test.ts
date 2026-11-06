import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addTaskDeliverableFiles,
  listTeamProjectDeliverables,
  readTeamDeliverableRecords,
  recordFinishedTaskDeliverables,
  recordTaskDeliverables,
  type TaskDeliverableRecord
} from './bot-team-deliverables-record'

let root: string
let storeDir: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'bot-team-records-'))
  storeDir = path.join(root, 'store')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function record(overrides: Partial<TaskDeliverableRecord> = {}): TaskDeliverableRecord {
  return {
    taskId: 'task-1',
    teamId: 'team_a1',
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    folder: root,
    kind: 'folder',
    since: Date.now() - 60_000,
    recordedAt: 1,
    ...overrides
  }
}

describe('the record of a finished task', () => {
  it('keeps one record per task, the latest one written', () => {
    recordTaskDeliverables(storeDir, record({ recordedAt: 1 }))
    recordTaskDeliverables(storeDir, record({ recordedAt: 2, workspaceId: 'workspace-2' }))

    const records = readTeamDeliverableRecords(storeDir, 'team_a1')

    expect(records).toHaveLength(1)
    expect(records[0]?.workspaceId).toBe('workspace-2')
  })

  it('keeps only the newest records of a team', () => {
    for (let index = 0; index < 205; index += 1) {
      recordTaskDeliverables(storeDir, record({ taskId: `task-${index}`, recordedAt: index }))
    }

    const records = readTeamDeliverableRecords(storeDir, 'team_a1')

    expect(records).toHaveLength(200)
    expect(records.at(-1)?.taskId).toBe('task-204')
    expect(records[0]?.taskId).toBe('task-5')
  })

  it('holds nothing for a missing or unreadable file', () => {
    expect(readTeamDeliverableRecords(storeDir, 'team_a1')).toEqual([])
    mkdirSync(storeDir, { recursive: true })
    writeFileSync(path.join(storeDir, 'team_a1.json'), '{ not json')

    expect(readTeamDeliverableRecords(storeDir, 'team_a1')).toEqual([])
  })

  it('refuses a team id that cannot name a file', () => {
    expect(() => readTeamDeliverableRecords(storeDir, '../escape')).toThrow()
  })

  it('records a task of a project that ran in a local folder', () => {
    const recorded = recordFinishedTaskDeliverables({
      storeDir,
      taskId: 'task-1',
      teamId: 'team_a1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      location: { path: root, local: true },
      since: 10,
      now: 20
    })

    expect(recorded).toMatchObject({ projectId: 'project-1', kind: 'folder', since: 10 })
    expect(readTeamDeliverableRecords(storeDir, 'team_a1')).toHaveLength(1)
  })

  it('records nothing for a task with no project, or one that ran where this host cannot list', () => {
    const base = {
      storeDir,
      taskId: 'task-1',
      teamId: 'team_a1',
      workspaceId: 'workspace-1',
      since: 10,
      now: 20
    }

    expect(
      recordFinishedTaskDeliverables({
        ...base,
        projectId: null,
        location: { path: root, local: true }
      })
    ).toBeNull()
    expect(
      recordFinishedTaskDeliverables({
        ...base,
        projectId: 'project-1',
        location: { path: root, local: false }
      })
    ).toBeNull()
    expect(readTeamDeliverableRecords(storeDir, 'team_a1')).toEqual([])
  })
})

describe('the files of a team’s linked projects', () => {
  it('lists a folder project’s files written since the task began, and leaves out dot and tool folders', async () => {
    const project = path.join(root, 'project')
    mkdirSync(path.join(project, 'docs', 'presentacion'), { recursive: true })
    mkdirSync(path.join(project, '.atl'), { recursive: true })
    mkdirSync(path.join(project, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(path.join(project, 'docs', 'presentacion', 'deck.html'), '<p>Deck</p>')
    writeFileSync(path.join(project, '.atl', 'skill-registry.md'), 'skills')
    writeFileSync(path.join(project, 'node_modules', 'pkg', 'index.js'), 'x')
    recordTaskDeliverables(storeDir, record({ folder: project }))

    const listed = await listTeamProjectDeliverables({
      storeDir,
      teamId: 'team_a1',
      projects: [{ projectId: 'project-1', name: 'NexusCare' }]
    })

    expect(listed.truncated).toBe(false)
    expect(listed.projects).toEqual([
      {
        projectId: 'project-1',
        name: 'NexusCare',
        files: [{ workspaceId: 'workspace-1', relativePath: 'docs/presentacion/deck.html' }]
      }
    ])
  })

  it('leaves out a project the team no longer has', async () => {
    recordTaskDeliverables(storeDir, record({ projectId: 'project-gone' }))

    const listed = await listTeamProjectDeliverables({
      storeDir,
      teamId: 'team_a1',
      projects: [{ projectId: 'project-1', name: 'NexusCare' }],
      listRecord: async () => ['brief.md']
    })

    expect(listed.projects).toEqual([])
  })

  it('lists a file that two tasks touched in one workspace once', async () => {
    recordTaskDeliverables(storeDir, record({ taskId: 'task-1', recordedAt: 1 }))
    recordTaskDeliverables(storeDir, record({ taskId: 'task-2', recordedAt: 2 }))

    const listed = await listTeamProjectDeliverables({
      storeDir,
      teamId: 'team_a1',
      projects: [{ projectId: 'project-1', name: 'NexusCare' }],
      listRecord: async () => ['docs/infografia-nexuscare.pdf']
    })

    expect(listed.projects[0]?.files).toHaveLength(1)
  })
})

describe('files a finished task registered by name', () => {
  it('lists a registered file even when it is old and a worktree diff would miss it', async () => {
    const project = path.join(root, 'project')
    mkdirSync(path.join(project, 'docs'), { recursive: true })
    writeFileSync(path.join(project, 'docs', 'reference.md'), '# Reference')
    recordTaskDeliverables(storeDir, record({ folder: project, since: Date.now() + 60_000 }))

    addTaskDeliverableFiles(storeDir, 'team_a1', 'task-1', ['docs/reference.md', 'docs/gone.md'])
    addTaskDeliverableFiles(storeDir, 'team_a1', 'task-1', ['docs/reference.md'])
    const listed = await listTeamProjectDeliverables({
      storeDir,
      teamId: 'team_a1',
      projects: [{ projectId: 'project-1', name: 'NexusCare' }]
    })

    expect(listed.projects[0]?.files).toEqual([
      { workspaceId: 'workspace-1', relativePath: 'docs/reference.md' }
    ])
  })

  it('keeps registered files when the task is recorded again, and ignores a task with no record', () => {
    recordTaskDeliverables(storeDir, record())
    addTaskDeliverableFiles(storeDir, 'team_a1', 'task-1', ['docs/reference.md'])
    addTaskDeliverableFiles(storeDir, 'team_a1', 'unknown', ['x.md'])
    recordFinishedTaskDeliverables({
      storeDir,
      taskId: 'task-1',
      teamId: 'team_a1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      location: { path: root, local: true },
      since: 10,
      now: 30
    })

    const records = readTeamDeliverableRecords(storeDir, 'team_a1')
    expect(records).toHaveLength(1)
    expect(records[0]?.files).toEqual(['docs/reference.md'])
  })
})
