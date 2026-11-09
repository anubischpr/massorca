import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readGitHubAccountChangeAnswer,
  readGitHubAccountInventoryAnswer
} from '../shared/rpc-contract/github-account-binding-params'

const mocks = vi.hoisted(() => ({
  listGhAccountBindingInventory: vi.fn(),
  switchGhActiveAccount: vi.fn(),
  removeGhAccount: vi.fn()
}))

vi.mock('../main/github/gh-account-binding-inventory', () => ({
  listGhAccountBindingInventory: mocks.listGhAccountBindingInventory
}))
vi.mock('../main/github/gh-account-switch', () => ({
  switchGhActiveAccount: mocks.switchGhActiveAccount
}))
vi.mock('../main/github/gh-account-logout', () => ({
  removeGhAccount: mocks.removeGhAccount
}))

import { GitHubAccountsHandler, RELAY_GITHUB_ACCOUNT_METHODS } from './relay-github-accounts'

type Handler = (params: Record<string, unknown>) => Promise<unknown>

function registerHandlers(): Map<string, Handler> {
  const handlers = new Map<string, Handler>()
  const dispatcher = {
    onRequest: vi.fn((method: string, handler: Handler) => {
      handlers.set(method, handler)
    })
  }
  new GitHubAccountsHandler(dispatcher as never)
  return handlers
}

function handlerFor(name: string): Handler {
  const handler = registerHandlers().get(name)
  if (!handler) {
    throw new Error(`relay does not serve ${name}`)
  }
  return handler
}

describe('GitHubAccountsHandler on the SSH relay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('serves exactly the three GitHub account methods the desktop calls', () => {
    expect([...registerHandlers().keys()].sort()).toEqual(
      [
        'github.listHostBindableAccounts',
        'github.switchActiveAccount',
        'github.removeAccount'
      ].sort()
    )
  })

  it('lists this host logins with only the fields the desktop reads', async () => {
    mocks.listGhAccountBindingInventory.mockResolvedValue({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'dev-box',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo'],
          token: 'gho_secret'
        }
      ]
    })

    const answer = await handlerFor(RELAY_GITHUB_ACCOUNT_METHODS.list)({})

    expect(answer).toEqual({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'dev-box',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo']
        }
      ]
    })
    expect(JSON.stringify(answer)).not.toContain('gho_secret')
    expect(readGitHubAccountInventoryAnswer(answer)).toEqual(answer)
  })

  it('switches one login after normalizing its host and user with the binding rules', async () => {
    mocks.switchGhActiveAccount.mockResolvedValue({ ok: true })

    const answer = await handlerFor(RELAY_GITHUB_ACCOUNT_METHODS.switchActiveAccount)({
      host: ' GitHub.com ',
      user: ' dev-box '
    })

    expect(mocks.switchGhActiveAccount).toHaveBeenCalledWith(
      { host: 'github.com', user: 'dev-box' },
      {}
    )
    expect(answer).toEqual({ ok: true })
    expect(readGitHubAccountChangeAnswer(answer)).toEqual({ ok: true })
  })

  it('refuses a host the binding rules reject before any gh call', async () => {
    const answer = await handlerFor(RELAY_GITHUB_ACCOUNT_METHODS.switchActiveAccount)({
      host: 'bad host; rm -rf /',
      user: 'dev-box'
    })

    expect(answer).toEqual({ ok: false, reason: 'invalid_account' })
    expect(mocks.switchGhActiveAccount).not.toHaveBeenCalled()
  })

  it('removes one login the same way', async () => {
    mocks.removeGhAccount.mockResolvedValue({ ok: true })

    const answer = await handlerFor(RELAY_GITHUB_ACCOUNT_METHODS.removeAccount)({
      host: 'github.com',
      user: 'dev-box'
    })

    expect(mocks.removeGhAccount).toHaveBeenCalledWith({ host: 'github.com', user: 'dev-box' }, {})
    expect(answer).toEqual({ ok: true })
  })

  it('answers a failed gh call as failed without passing its output through', async () => {
    mocks.removeGhAccount.mockRejectedValue(new Error('gh printed gho_leak'))

    const answer = await handlerFor(RELAY_GITHUB_ACCOUNT_METHODS.removeAccount)({
      host: 'github.com',
      user: 'dev-box'
    })

    expect(answer).toEqual({ ok: false, reason: 'failed' })
    expect(JSON.stringify(answer)).not.toContain('gho_leak')
  })
})
