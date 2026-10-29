import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  readMobilePrototypeCountSetting,
  writeMobilePrototypeCountSetting
} from './mobile-prototype-count-setting'

type HostClient = Pick<RpcClient, 'sendRequest'>

const ok = (result: unknown): RpcResponse => ({ ok: true, result, id: 'rpc-1' })

function clientAnswering(response: RpcResponse | Error): {
  client: HostClient
  sendRequest: ReturnType<typeof vi.fn<HostClient['sendRequest']>>
} {
  const sendRequest = vi.fn<HostClient['sendRequest']>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  )
  return { client: { sendRequest }, sendRequest }
}

describe('readMobilePrototypeCountSetting', () => {
  it('reads the setting the host holds', async () => {
    const { client } = clientAnswering(
      ok({ settings: { prototypeCount: { mode: 'ask', count: 3 } } })
    )
    expect(await readMobilePrototypeCountSetting(client)).toEqual({ mode: 'ask', count: 3 })
  })

  it('sanitizes what the host holds, each field to its own default', async () => {
    const { client } = clientAnswering(
      ok({ settings: { prototypeCount: { mode: 'sometimes', count: 99 } } })
    )
    expect(await readMobilePrototypeCountSetting(client)).toEqual({ mode: 'always', count: 4 })
  })

  it('reads a host with no setting as "Always make 2"', async () => {
    const { client } = clientAnswering(ok({ settings: {} }))
    expect(await readMobilePrototypeCountSetting(client)).toEqual({ mode: 'always', count: 2 })
  })

  it('reads a host that does not answer as "Always make 2"', async () => {
    const { client } = clientAnswering(new Error('offline'))
    expect(await readMobilePrototypeCountSetting(client)).toEqual({ mode: 'always', count: 2 })
  })
})

describe('writeMobilePrototypeCountSetting', () => {
  it('writes only the prototype setting, sanitized', async () => {
    const { client, sendRequest } = clientAnswering(ok({}))
    await writeMobilePrototypeCountSetting(client, { mode: 'ask', count: 9 })
    expect(sendRequest).toHaveBeenCalledTimes(1)
    expect(sendRequest.mock.calls[0]?.[0]).toBe('settings.update')
    expect(sendRequest.mock.calls[0]?.[1]).toEqual({ prototypeCount: { mode: 'ask', count: 4 } })
  })

  it('never throws when the host refuses or is unreachable', async () => {
    const { client } = clientAnswering(new Error('offline'))
    await expect(
      writeMobilePrototypeCountSetting(client, { mode: 'always', count: 2 })
    ).resolves.toBeUndefined()
  })
})
