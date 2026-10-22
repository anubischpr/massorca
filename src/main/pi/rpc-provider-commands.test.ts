import { describe, expect, it, vi } from 'vitest'
import { JsonlRpcResponseError } from '../jsonl-rpc/peer'
import { runPiProviderCommand } from './rpc-provider-commands'

function session(request: (command: string, params?: Record<string, unknown>) => Promise<unknown>) {
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the commands under test call only `request`.
    connection: { request } as never
  }
}

describe('runPiProviderCommand', () => {
  it('names the session and returns the name for the chat title', async () => {
    const request = vi.fn(async () => undefined)
    const outcome = await runPiProviderCommand(session(request), {
      command: 'name',
      argument: 'my-feature'
    })
    expect(request).toHaveBeenCalledWith('set_session_name', { name: 'my-feature' })
    expect(outcome).toMatchObject({ ok: true, conversationName: 'my-feature' })
  })

  it('exports HTML and shows the path Pi reports, with no file transfer', async () => {
    const request = vi.fn(async () => ({ path: '/tmp/session.html' }))
    const outcome = await runPiProviderCommand(session(request), { command: 'export' })
    expect(request).toHaveBeenCalledWith('export_html', {})
    expect(outcome).toMatchObject({
      ok: true,
      notice: { text: 'Exported the session to /tmp/session.html on the host that runs Pi.' }
    })
    await runPiProviderCommand(session(request), { command: 'export', argument: '/tmp/x.html' })
    expect(request).toHaveBeenLastCalledWith('export_html', { outputPath: '/tmp/x.html' })
  })

  it('says so when this Pi does not know the command', async () => {
    const request = async () => {
      throw new JsonlRpcResponseError('export_html', 'Unknown command: export_html')
    }
    expect(await runPiProviderCommand(session(request), { command: 'export' })).toEqual({
      ok: true,
      notice: { text: '/export is not supported by this version of Pi.', tone: 'warning' }
    })
  })

  it("rejects with Pi's words on any other refusal", async () => {
    const request = async () => {
      throw new JsonlRpcResponseError('export_html', 'disk full')
    }
    expect(await runPiProviderCommand(session(request), { command: 'export' })).toEqual({
      ok: false,
      rejected: 'disk full'
    })
  })
})
