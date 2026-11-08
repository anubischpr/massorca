import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import type { RuntimeClient } from '../runtime-client'
import { THEME_HANDLERS } from './theme'

const callMock = vi.fn()
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the theme handlers only use client.call.
const client = { call: callMock } as unknown as RuntimeClient

function run(key: string, flags: [string, string | boolean][] = [], json = false): Promise<void> {
  const ctx: HandlerContext = { flags: new Map(flags), client, cwd: '/w', json }
  return THEME_HANDLERS[key](ctx)
}

let logs: string[] = []

beforeEach(() => {
  callMock.mockReset()
  logs = []
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logs.push(String(line))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('orca theme', () => {
  it('get prints the saved theme', async () => {
    callMock.mockResolvedValue({ id: '1', ok: true, result: { theme: 'system' }, _meta: {} })
    await run('theme get')
    expect(callMock).toHaveBeenCalledWith('appearance.getTheme')
    expect(logs.join('\n')).toContain('system')
  })

  it('set saves the theme the user names', async () => {
    callMock.mockResolvedValue({ id: '1', ok: true, result: { theme: 'dark' }, _meta: {} })
    await run('theme set', [['theme', 'dark']])
    expect(callMock).toHaveBeenCalledWith('appearance.setTheme', { theme: 'dark' })
    expect(logs.join('\n')).toContain('dark')
  })

  it('set refuses a theme that is not light, dark or system', async () => {
    await expect(run('theme set', [['theme', 'blue']])).rejects.toThrow(
      'Theme must be light, dark or system'
    )
    expect(callMock).not.toHaveBeenCalled()
  })
})
