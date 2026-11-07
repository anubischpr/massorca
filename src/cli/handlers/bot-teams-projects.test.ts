import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { RuntimeClientError } from '../runtime/types'
import { okFixture } from '../test-fixtures'
import { LAUNCH, TEAM, TASK_1, roomWith, routeRpcFixtures } from '../bot-teams-test-fixtures'

const TASK_8 = { ...TASK_1, id: 'task-8', title: 'Write notes' }
const ROOM_AND_TEAM = {
  'botTeams.listRoom': okFixture('req_room', roomWith()),
  'botTeams.list': okFixture('req_list', { teams: [TEAM] })
}

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

describe('orca bot-teams task and project writes', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('saves a task to Todo for a bot by name', async () => {
    routeRpcFixtures(callMock, {
      ...ROOM_AND_TEAM,
      'botTeams.createTask': okFixture('req_task', { task: TASK_8 })
    })

    await main(
      [
        'bot-teams',
        'task',
        'create',
        '--team',
        'team-1',
        '--title',
        'Write notes',
        '--bot',
        'Pepe',
        '--prompt',
        'Use the brief'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.createTask', {
      teamId: 'team-1',
      title: 'Write notes',
      prompt: 'Use the brief',
      ownerBotId: 'bot-2'
    })
    expect(printed()).toBe('Saved task task-8 (Write notes) to Todo.')
  })

  it('starts a task by id', async () => {
    routeRpcFixtures(callMock, { 'botTeams.startTask': okFixture('req_start', { task: TASK_8 }) })

    await main(['bot-teams', 'task', 'start', '--task', 'task-8'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.startTask', { taskId: 'task-8' })
    expect(printed()).toBe('Started task task-8.')
  })

  it('gives an idle task to a bot by name', async () => {
    routeRpcFixtures(callMock, {
      ...ROOM_AND_TEAM,
      'botTeams.reassignTask': okFixture('req_reassign', { task: TASK_8, startError: null })
    })

    await main(
      [
        'bot-teams',
        'task',
        'reassign',
        '--team',
        'team-1',
        '--task',
        'task-8',
        '--bot',
        'Estrellita'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.reassignTask', {
      taskId: 'task-8',
      botId: 'bot-1'
    })
    expect(printed()).toBe('Gave task task-8 to Estrellita.')
  })

  it('sets a task project by name, and clears it with none', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.setTaskProject': okFixture('req_set', {
        task: { ...TASK_8, projectId: 'project-1' }
      })
    })

    await main(
      [
        'bot-teams',
        'task',
        'set-project',
        '--team',
        'team-1',
        '--task',
        'task-8',
        '--project',
        'Launch'
      ],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenCalledWith('botTeams.setTaskProject', {
      taskId: 'task-8',
      projectId: 'project-1'
    })
    expect(printed()).toBe('Set task task-8 to project Launch.')

    vi.mocked(console.log).mockClear()
    await main(
      [
        'bot-teams',
        'task',
        'set-project',
        '--team',
        'team-1',
        '--task',
        'task-8',
        '--project',
        'none'
      ],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenLastCalledWith('botTeams.setTaskProject', {
      taskId: 'task-8',
      projectId: null
    })
    expect(printed()).toBe('Removed task task-8 from its project.')
  })

  it('creates a project with its code source', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.createProject': okFixture('req_project', {
        project: { ...LAUNCH, id: 'project-2', name: 'Website' }
      })
    })

    await main(
      [
        'bot-teams',
        'project',
        'create',
        '--team',
        'team-1',
        '--name',
        'Website',
        '--goal',
        'Relaunch',
        '--code-source',
        'repo'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.createProject', {
      teamId: 'team-1',
      name: 'Website',
      goal: 'Relaunch',
      codeSource: 'repo'
    })
    expect(printed()).toBe('Created project Website (project-2).')
  })

  it('renames a project found by name', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.updateProject': okFixture('req_update', {
        project: { ...LAUNCH, name: 'Launch 2' }
      })
    })

    await main(
      [
        'bot-teams',
        'project',
        'update',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--name',
        'Launch 2'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.updateProject', {
      projectId: 'project-1',
      teamId: 'team-1',
      name: 'Launch 2'
    })
    expect(printed()).toBe('Updated project Launch 2 (project-1).')
  })

  it('archives and restores a project', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.archiveProject': okFixture('req_archive', { project: { ...LAUNCH, archivedAt: 5 } })
    })

    await main(
      ['bot-teams', 'project', 'archive', '--team', 'team-1', '--project', 'Launch'],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenCalledWith('botTeams.archiveProject', {
      projectId: 'project-1',
      teamId: 'team-1',
      archived: true
    })
    expect(printed()).toBe('Archived project Launch (project-1).')

    vi.mocked(console.log).mockClear()
    await main(
      ['bot-teams', 'project', 'restore', '--team', 'team-1', '--project', 'Launch'],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenLastCalledWith('botTeams.archiveProject', {
      projectId: 'project-1',
      teamId: 'team-1',
      archived: false
    })
    expect(printed()).toBe('Restored project Launch (project-1).')
  })

  it('deletes a project found by name', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.deleteProject': okFixture('req_delete', { deleted: true })
    })

    await main(
      ['bot-teams', 'project', 'rm', '--team', 'team-1', '--project', 'Launch'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.deleteProject', {
      projectId: 'project-1',
      teamId: 'team-1'
    })
    expect(printed()).toBe('Deleted project Launch (project-1).')
  })

  it('saves a project brief from JSON and keeps the goal', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.setProjectBrief': okFixture('req_brief', { project: LAUNCH })
    })

    await main(
      [
        'bot-teams',
        'project',
        'brief',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--brief-json',
        '{"requirements":["Ship by Friday"],"constraints":[],"decisions":["Use Vite"]}'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.setProjectBrief', {
      projectId: 'project-1',
      goal: 'Ship it',
      brief: { requirements: ['Ship by Friday'], constraints: [], decisions: ['Use Vite'] }
    })
    expect(printed()).toBe('Saved the brief of project Launch (project-1).')
  })

  it('refuses a brief JSON that leaves out a list', async () => {
    await main(
      [
        'bot-teams',
        'project',
        'brief',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--brief-json',
        '{"requirements":[]}'
      ],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain(
      'requirements, constraints and decisions'
    )
    expect(process.exitCode).toBe(1)
  })

  it('sets a project code source', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.setProjectCodeSource': okFixture('req_source', {
        project: { ...LAUNCH, codeSource: 'folder' }
      })
    })

    await main(
      [
        'bot-teams',
        'project',
        'code-source',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--source',
        'folder'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.setProjectCodeSource', {
      projectId: 'project-1',
      codeSource: 'folder'
    })
    expect(printed()).toBe('Set project Launch to folder code.')
  })

  it('links a project to a workspace, and unlinks it with none', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.setProjectWorkspace': okFixture('req_ws', { project: LAUNCH })
    })

    await main(
      [
        'bot-teams',
        'project',
        'workspace',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--workspace',
        'folder-ws-1'
      ],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenCalledWith('botTeams.setProjectWorkspace', {
      projectId: 'project-1',
      workspaceKey: 'folder-ws-1'
    })
    expect(printed()).toBe('Linked project Launch to workspace folder-ws-1.')

    vi.mocked(console.log).mockClear()
    await main(
      [
        'bot-teams',
        'project',
        'workspace',
        '--team',
        'team-1',
        '--project',
        'Launch',
        '--workspace',
        'none'
      ],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenLastCalledWith('botTeams.setProjectWorkspace', {
      projectId: 'project-1',
      workspaceKey: null
    })
    expect(printed()).toBe('Unlinked project Launch from its workspace.')
  })

  it('tells the person to update MassOrca when the host predates a method', async () => {
    callMock.mockRejectedValueOnce(new RuntimeClientError('method_not_found', 'Method not found'))

    await main(
      ['bot-teams', 'project', 'create', '--team', 'team-1', '--name', 'Website'],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('Update MassOrca on the host first')
    expect(process.exitCode).toBe(1)
  })
})
