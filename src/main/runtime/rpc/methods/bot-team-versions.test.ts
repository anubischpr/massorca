import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { takeBotTeamSnapshot } from '../../../bot-teams/bot-team-snapshots'
import type { RpcContext } from '../core'

const probe = vi.hoisted(() => vi.fn(async () => true))
const where = vi.hoisted(() => ({ root: '' }))

vi.mock('../../../git/git-availability', () => ({ probeGitAvailability: probe }))
vi.mock('../../../bot-teams/bot-team-version-deps', () => ({
  botTeamVersionDeps: (teamId: string) => ({
    folder: path.join(where.root, 'folders', teamId),
    gitDir: path.join(where.root, 'versions', `${teamId}.git`)
  })
}))

import { BOT_TEAM_VERSION_METHODS } from './bot-team-versions'

async function call(name: string, params: Record<string, string>): Promise<unknown> {
  const method = BOT_TEAM_VERSION_METHODS.find((entry) => entry.name === name)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these handlers read no part of the context.
  return method?.handler(params as never, {} as RpcContext)
}

describe('the version methods', () => {
  beforeEach(async () => {
    where.root = await mkdtemp(path.join(tmpdir(), 'bot-team-version-rpc-'))
    probe.mockResolvedValue(true)
  })

  afterEach(async () => {
    await rm(where.root, { recursive: true, force: true })
  })

  const folder = (teamId: string) => path.join(where.root, 'folders', teamId)

  it('answers with no versions for a team that has no folder yet, without asking Git', async () => {
    expect(await call('botTeams.versions', { teamId: 't1' })).toEqual({
      git: 'ok',
      versions: [],
      lastVersionOfFile: {}
    })
    expect(probe).not.toHaveBeenCalled()
  })

  it('says versions are unavailable only when the host has no Git', async () => {
    await mkdir(folder('t1'), { recursive: true })
    probe.mockResolvedValue(false)
    expect(await call('botTeams.versions', { teamId: 't1' })).toEqual({ git: 'unavailable' })
    probe.mockResolvedValue(true)
    expect(await call('botTeams.versions', { teamId: 't1' })).toMatchObject({ git: 'ok' })
    probe.mockRejectedValue(new Error('timed out'))
    expect(await call('botTeams.versions', { teamId: 't1' })).toMatchObject({ git: 'ok' })
  })

  it('lists versions with the newest version of each file, reads one and restores it', async () => {
    await mkdir(folder('t1'), { recursive: true })
    const deps = {
      folder: folder('t1'),
      gitDir: path.join(where.root, 'versions', 't1.git')
    }
    await writeFile(path.join(deps.folder, 'flyer.html'), 'v1')
    const first = await takeBotTeamSnapshot(deps, {
      reason: 'task-finished',
      label: 'First',
      author: 'Iris'
    })
    await writeFile(path.join(deps.folder, 'flyer.html'), 'v2')

    const listed = (await call('botTeams.versions', { teamId: 't1' })) as {
      versions: { id: string; author: string | null }[]
      lastVersionOfFile: Record<string, string>
    }
    expect(listed.versions.map((version) => version.author)).toEqual(['Iris'])
    expect(listed.lastVersionOfFile).toEqual({ 'flyer.html': '000001' })

    const versionId = first.ok && first.version ? first.version.id : ''
    expect(
      await call('botTeams.versionFile', { teamId: 't1', versionId, relativePath: 'flyer.html' })
    ).toEqual({ file: { kind: 'text', text: 'v1' } })
    expect(
      await call('botTeams.fileVersions', { teamId: 't1', relativePath: 'flyer.html' })
    ).toEqual({
      versions: [{ version: expect.objectContaining({ id: versionId }), deleted: false }]
    })

    const restored = await call('botTeams.restoreFileVersion', {
      teamId: 't1',
      versionId,
      relativePath: 'flyer.html'
    })
    expect(restored).toMatchObject({ result: { ok: true } })
    expect(await readFile(path.join(deps.folder, 'flyer.html'), 'utf8')).toBe('v1')
  })
})
