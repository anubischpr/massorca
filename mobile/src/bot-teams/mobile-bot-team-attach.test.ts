import { describe, expect, it, vi } from 'vitest'
import { CLIPBOARD_IMAGE_MAX_BASE64_CHARS } from '../../../src/shared/clipboard-image'
import {
  roomAttachmentsSupported,
  safeBotTeamRoomFileName,
  uploadMobileBotTeamRoomFile
} from './mobile-bot-team-attach'

const WORKSPACE = 'ws-1'

/** A host whose path checks answer `pathChecks` in order and whose write answers `writeOk`. */
function hostFor(pathChecks: unknown[][], writeOk = true) {
  const queue = [...pathChecks]
  const sendRequest = vi.fn(async (method: string) => {
    if (method === 'files.pathsExist') {
      return { ok: true, result: queue.shift() ?? [{ exists: false }] }
    }
    if (method === 'files.writeBase64') {
      return writeOk
        ? { ok: true, result: { ok: true } }
        : { ok: false, error: { code: 'internal', message: 'refused' } }
    }
    return { ok: false, error: { code: 'unknown', message: 'unexpected' } }
  })
  return { sendRequest }
}

describe('roomAttachmentsSupported', () => {
  it('is true only for a host that advertises the room attachments capability', () => {
    expect(roomAttachmentsSupported(['bot-team.room-attachments.v1'])).toBe(true)
    expect(roomAttachmentsSupported(['files.pathsExist'])).toBe(false)
    expect(roomAttachmentsSupported([])).toBe(false)
  })
})

describe('safeBotTeamRoomFileName', () => {
  it('keeps a plain name and replaces separators and reserved characters', () => {
    expect(safeBotTeamRoomFileName('notes.pdf')).toBe('notes.pdf')
    expect(safeBotTeamRoomFileName('a/b\\c:d*.txt')).toBe('a_b_c_d_.txt')
  })

  it('falls back to a fixed name for an empty or blank name', () => {
    expect(safeBotTeamRoomFileName('   ')).toBe('file')
  })
})

describe('uploadMobileBotTeamRoomFile', () => {
  it('writes the file into the team folder attachments folder and returns its attachment', async () => {
    const client = hostFor([[{ exists: false }]])

    const result = await uploadMobileBotTeamRoomFile(client, {
      workspaceId: WORKSPACE,
      name: 'notes.txt',
      contentBase64: 'aGk='
    })

    expect(result).toEqual({
      kind: 'attached',
      attachment: { path: 'attachments/notes.txt', name: 'notes.txt' }
    })
    expect(client.sendRequest).toHaveBeenCalledWith(
      'files.writeBase64',
      {
        worktree: `id:${WORKSPACE}`,
        relativePath: 'attachments/notes.txt',
        contentBase64: 'aGk='
      },
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    )
  })

  it('picks the next free name when the name is already in the folder', async () => {
    const client = hostFor([[{ exists: true }], [{ exists: false }]])

    const result = await uploadMobileBotTeamRoomFile(client, {
      workspaceId: WORKSPACE,
      name: 'notes.txt',
      contentBase64: 'aGk='
    })

    expect(result).toEqual({
      kind: 'attached',
      attachment: { path: 'attachments/notes (2).txt', name: 'notes (2).txt' }
    })
  })

  it('refuses a file larger than the phone can send, without contacting the host', async () => {
    const client = hostFor([])

    const result = await uploadMobileBotTeamRoomFile(client, {
      workspaceId: WORKSPACE,
      name: 'big.bin',
      contentBase64: 'A'.repeat(CLIPBOARD_IMAGE_MAX_BASE64_CHARS + 1)
    })

    expect(result).toEqual({ kind: 'too-large' })
    expect(client.sendRequest).not.toHaveBeenCalled()
  })

  it('reports failure when the host refuses the write', async () => {
    const client = hostFor([[{ exists: false }]], false)

    const result = await uploadMobileBotTeamRoomFile(client, {
      workspaceId: WORKSPACE,
      name: 'notes.txt',
      contentBase64: 'aGk='
    })

    expect(result).toEqual({ kind: 'failed' })
  })

  it('reports failure when the host cannot say whether the name is taken', async () => {
    const client = hostFor([[{ error: 'denied' }]])

    const result = await uploadMobileBotTeamRoomFile(client, {
      workspaceId: WORKSPACE,
      name: 'notes.txt',
      contentBase64: 'aGk='
    })

    expect(result).toEqual({ kind: 'failed' })
  })
})
