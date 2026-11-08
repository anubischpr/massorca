import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppMention } from '../../../src/shared/marketplace-app-mentions'
import type { RpcResponse } from '../transport/types'
import {
  listMobileBotTeamConnectedApps,
  useBotTeamMentionApps
} from './use-mobile-bot-team-mention-apps'

function hostReplying(response: RpcResponse) {
  return { sendRequest: vi.fn(async () => response) }
}

const OK: RpcResponse = {
  id: '1',
  ok: true,
  result: {
    apps: [
      { id: 'engram', name: 'Engram' },
      { id: 'jira', name: 'Jira' }
    ]
  },
  _meta: { runtimeId: 'r' }
}
const MISSING: RpcResponse = {
  id: '1',
  ok: false,
  error: { code: 'method_not_found', message: 'Unknown method: botTeams.connectedApps' },
  _meta: { runtimeId: 'r' }
}

describe('listMobileBotTeamConnectedApps', () => {
  it('lists the connected apps this phone knows, by their mention name', async () => {
    const client = hostReplying(OK)
    await expect(listMobileBotTeamConnectedApps(client, 'team-1')).resolves.toEqual([
      { id: 'engram', name: 'Engram' }
    ])
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.connectedApps',
      { teamId: 'team-1' },
      {
        timeoutMs: 15_000
      }
    )
  })

  it('lists none for an older host without the method', async () => {
    await expect(listMobileBotTeamConnectedApps(hostReplying(MISSING), 'team-1')).resolves.toEqual(
      []
    )
  })

  it('lists none when the request throws', async () => {
    const client = {
      sendRequest: vi.fn(async (): Promise<RpcResponse> => {
        throw new Error('closed')
      })
    }
    await expect(listMobileBotTeamConnectedApps(client, 'team-1')).resolves.toEqual([])
  })
})

describe('useBotTeamMentionApps', () => {
  async function render(client: ReturnType<typeof hostReplying>, offline: boolean) {
    let apps: readonly MarketplaceAppMention[] = []
    const Probe = () => {
      apps = useBotTeamMentionApps(client, 't1', offline)
      return null
    }
    await act(async () => {
      create(createElement(Probe))
    })
    return apps
  }

  it('reads the apps once for the room', async () => {
    const client = hostReplying(OK)
    await expect(render(client, false)).resolves.toEqual([{ id: 'engram', name: 'Engram' }])
    expect(client.sendRequest).toHaveBeenCalledTimes(1)
  })

  it('asks nothing while offline', async () => {
    const client = hostReplying(OK)
    await expect(render(client, true)).resolves.toEqual([])
    expect(client.sendRequest).not.toHaveBeenCalled()
  })
})
