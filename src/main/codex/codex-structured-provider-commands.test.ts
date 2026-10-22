import { describe, expect, it, vi } from 'vitest'
import { CodexAppServerRequestError } from './codex-app-server-request-error'
import { codexPluginsListing, codexSkillsListing } from './codex-provider-command-listings'
import { run } from './codex-structured-provider-commands'

function session(request: (method: string, params?: Record<string, unknown>) => Promise<unknown>) {
  return {
    threadId: 'thread-1',
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the commands under test call only `request`.
    connection: { request } as never
  }
}

describe('codex skills and plugins listings', () => {
  it('lists enabled skills first with their short description', () => {
    const text = codexSkillsListing({
      data: [
        {
          skills: [
            { name: 'zeta', enabled: false, description: 'off' },
            {
              name: 'alpha',
              enabled: true,
              description: 'long',
              interface: { shortDescription: 'short' }
            }
          ]
        }
      ]
    })
    expect(text.split('\n')).toEqual(['Skills (2)', 'alpha  short', 'zeta   (disabled) off'])
  })

  it('lists installed plugins and counts the rest', () => {
    const text = codexPluginsListing({
      marketplaces: [
        {
          plugins: [
            { name: 'a', installed: true, enabled: true, interface: { displayName: 'Alpha' } },
            { name: 'b', installed: false, enabled: false }
          ]
        }
      ]
    })
    expect(text).toBe('Installed plugins (1)\nAlpha\n1 more available to install in Codex.')
  })
})

describe('run', () => {
  it('answers usage with the card presentation and no provider call', async () => {
    const request = vi.fn()
    const outcome = await run(session(request), { command: 'usage' }, 1000)
    expect(outcome).toMatchObject({ ok: true, notice: { presentation: 'codex-usage' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('reads skills from the app-server', async () => {
    const request = vi.fn(async () => ({ data: [] }))
    const outcome = await run(session(request), { command: 'skills' }, 1000)
    expect(request).toHaveBeenCalledWith('skills/list', {}, { timeoutMs: 1000 })
    expect(outcome).toMatchObject({ ok: true, notice: { text: 'Skills: none.' } })
  })

  it('says so when the app-server lacks the method', async () => {
    const request = async () => {
      throw new CodexAppServerRequestError('plugin/list', -32601, 'Method not found')
    }
    const outcome = await run(session(request), { command: 'plugins' }, 1000)
    expect(outcome).toEqual({
      ok: true,
      notice: { text: '/plugins is not supported by this version of Codex.', tone: 'warning' }
    })
  })

  it('rejects with the app-server words on any other refusal', async () => {
    const request = async () => {
      throw new CodexAppServerRequestError('plugin/list', -32000, 'boom')
    }
    expect(await run(session(request), { command: 'plugins' }, 1000)).toEqual({
      ok: false,
      rejected: 'boom'
    })
  })
})
