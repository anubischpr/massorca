import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY } from '../../../../shared/bot-team-room-attachments'

const importExternalPathsToRuntime = vi.fn()
const callRuntimeRpc = vi.fn()
const findKnownWorktreeById = vi.fn()

vi.mock('@/runtime/runtime-file-import-client', () => ({
  importExternalPathsToRuntime: (...args: unknown[]) => importExternalPathsToRuntime(...args)
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: (...args: unknown[]) => callRuntimeRpc(...args)
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ settings: null }) } }))
vi.mock('@/store/slices/worktrees/listing/detected-worktree-meta', () => ({
  findKnownWorktreeById: (...args: unknown[]) => findKnownWorktreeById(...args)
}))
vi.mock('@/lib/local-file-access', () => ({ userNamedFileAccess: () => 'user-named' }))

const { attachBotTeamRoomFiles, botTeamRoomAttachmentsSupported } =
  await import('./bot-team-room-attach-upload')

describe('bot team room file upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies the picked files into the attachments folder of the team folder', async () => {
    findKnownWorktreeById.mockReturnValue({ path: '/data/bot-teams/t1' })
    importExternalPathsToRuntime.mockResolvedValue({
      results: [
        {
          sourcePath: '/Users/me/flyer.png',
          status: 'imported',
          destPath: '/data/bot-teams/t1/attachments/flyer.png',
          kind: 'file',
          renamed: false
        }
      ]
    })

    const result = await attachBotTeamRoomFiles({
      host: 'local',
      workspaceId: 'folder_1',
      sourcePaths: ['/Users/me/flyer.png']
    })

    expect(importExternalPathsToRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'folder_1', worktreePath: '/data/bot-teams/t1' }),
      ['/Users/me/flyer.png'],
      '/data/bot-teams/t1/attachments',
      expect.objectContaining({ ensureDestinationDir: true })
    )
    expect(result).toEqual({
      attachments: [{ path: 'attachments/flyer.png', name: 'flyer.png' }],
      failed: []
    })
  })

  it('names the file the copy renamed, and reports what it did not take', async () => {
    findKnownWorktreeById.mockReturnValue({ path: '/data/bot-teams/t1' })
    importExternalPathsToRuntime.mockResolvedValue({
      results: [
        {
          sourcePath: '/Users/me/flyer.png',
          status: 'imported',
          destPath: '/data/bot-teams/t1/attachments/flyer copy.png',
          kind: 'file',
          renamed: true
        },
        { sourcePath: '/Users/me/huge.bin', status: 'failed', reason: 'Disk is full' },
        {
          sourcePath: '/Users/me/Folder',
          status: 'imported',
          destPath: '/data/bot-teams/t1/attachments/Folder',
          kind: 'directory',
          renamed: false
        }
      ]
    })

    const result = await attachBotTeamRoomFiles({
      host: 'local',
      workspaceId: 'folder_1',
      sourcePaths: ['/Users/me/flyer.png', '/Users/me/huge.bin', '/Users/me/Folder']
    })

    expect(result.attachments).toEqual([
      { path: 'attachments/flyer copy.png', name: 'flyer copy.png' }
    ])
    expect(result.failed).toEqual([
      { sourcePath: '/Users/me/huge.bin', reason: 'Disk is full' },
      { sourcePath: '/Users/me/Folder', reason: 'Folders cannot be attached.' }
    ])
  })

  it('refuses while the team folder is not known on its host yet', async () => {
    findKnownWorktreeById.mockReturnValue(undefined)

    await expect(
      attachBotTeamRoomFiles({ host: 'local', workspaceId: 'folder_1', sourcePaths: ['/a.png'] })
    ).rejects.toThrow('The team folder is not ready on its host yet.')
    expect(importExternalPathsToRuntime).not.toHaveBeenCalled()
  })

  it('takes files on this computer without asking a server', async () => {
    expect(await botTeamRoomAttachmentsSupported('local')).toBe(true)
    expect(callRuntimeRpc).not.toHaveBeenCalled()
  })

  it('takes files on a paired server only when it advertises the capability', async () => {
    callRuntimeRpc.mockResolvedValueOnce({
      capabilities: [BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY]
    })
    expect(await botTeamRoomAttachmentsSupported('env_1')).toBe(true)

    callRuntimeRpc.mockResolvedValueOnce({ capabilities: ['agent-session.attachments.v1'] })
    expect(await botTeamRoomAttachmentsSupported('env_1')).toBe(false)
  })

  it('treats a server that cannot answer its status as unable to take files', async () => {
    callRuntimeRpc.mockRejectedValueOnce(new Error('offline'))

    expect(await botTeamRoomAttachmentsSupported('env_1')).toBe(false)
  })
})
