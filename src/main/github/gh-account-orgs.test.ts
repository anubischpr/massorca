import { beforeEach, describe, expect, it, vi } from 'vitest'

const ghExecFileAsync = vi.hoisted(() => vi.fn())
vi.mock('../git/runner', () => ({ ghExecFileAsync }))

import { ghAccountKey } from '../../shared/github/gh-account-inference'
import { listGhAccountOrgs, resetGhAccountOrgsCacheForTests } from './gh-account-orgs'

const palomino = { host: 'github.com', user: 'palominoc' }
const anubis = { host: 'github.com', user: 'anubischpr' }

beforeEach(() => {
  ghExecFileAsync.mockReset()
  resetGhAccountOrgsCacheForTests()
})

describe('listGhAccountOrgs', () => {
  it('parses one org login per line, keyed by account', async () => {
    ghExecFileAsync.mockResolvedValueOnce({ stdout: 'acme\n  beta \n\n', stderr: '' })

    const orgs = await listGhAccountOrgs([palomino])

    expect(orgs).toEqual({ [ghAccountKey(palomino)]: ['acme', 'beta'] })
    expect(ghExecFileAsync).toHaveBeenCalledWith(
      ['api', 'user/orgs', '--paginate', '--jq', '.[].login'],
      expect.objectContaining({ host: 'github.com', ghAccount: palomino })
    )
  })

  it('serves a repeat lookup from cache until the TTL expires', async () => {
    ghExecFileAsync.mockResolvedValue({ stdout: 'acme\n', stderr: '' })
    let now = 1_000

    await listGhAccountOrgs([palomino], {}, () => now)
    await listGhAccountOrgs([palomino], {}, () => now + 60_000)
    expect(ghExecFileAsync).toHaveBeenCalledTimes(1)

    now += 10 * 60 * 1000 + 1
    await listGhAccountOrgs([palomino], {}, () => now)
    expect(ghExecFileAsync).toHaveBeenCalledTimes(2)
  })

  it('maps a failed lookup to an empty list instead of guessing', async () => {
    ghExecFileAsync.mockRejectedValueOnce(new Error('gh: not logged in'))

    await expect(listGhAccountOrgs([palomino, anubis])).resolves.toEqual({
      [ghAccountKey(palomino)]: [],
      [ghAccountKey(anubis)]: []
    })
  })

  it('drops malformed accounts before looking anything up', async () => {
    ghExecFileAsync.mockResolvedValue({ stdout: 'acme\n', stderr: '' })

    const orgs = await listGhAccountOrgs([{ host: '', user: 'x' }, null, palomino])

    expect(Object.keys(orgs)).toEqual([ghAccountKey(palomino)])
    expect(ghExecFileAsync).toHaveBeenCalledTimes(1)
  })
})
