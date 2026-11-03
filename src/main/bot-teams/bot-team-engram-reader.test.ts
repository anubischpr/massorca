import { describe, expect, it, vi } from 'vitest'
import {
  parseEngramContext,
  parseEngramSearch,
  readEngramMemories,
  type EngramRunner
} from './bot-team-engram-reader'

const BANNER = `Update available: 3.3.2 -> 3.6.0
To update:
  go install github.com/example/engram@latest
  or: https://example.com/releases/latest

`
const SEARCH = `${BANNER}Found 2 memories:

[1] #14185 (passive) — Hidden panels stay in the DOM...
    Hidden panels stay in the DOM, so helpers must filter by visible.
    2026-11-01 05:34:24 | project: demo | scope: project

[2] #14048 (decision) — Finished child keeps its branch
    The branch is kept after a finish.
    Second line of the body.
    2026-10-31 05:00:40 | project: demo | scope: project
`
const CONTEXT = `${BANNER}## Memory from Previous Sessions

### Recent Sessions
- **demo** (2026-10-30 16:27:06) [164 observations]

### Recent Observations
- [passive] **First title...**: First body text.
- [discovery] **Second title**: Second body.
- [passive] **Third**: Third body.
`

const ok = (stdout: string): EngramRunner =>
  vi.fn(async () => ({ code: 0, stdout, timedOut: false }))

describe('engram output parsing', () => {
  it('reads search results past the update banner', () => {
    expect(parseEngramSearch(SEARCH)).toEqual([
      {
        id: '14185',
        title: 'Hidden panels stay in the DOM...',
        type: 'passive',
        excerpt: 'Hidden panels stay in the DOM, so helpers must filter by visible.',
        createdAt: '2026-11-01 05:34:24'
      },
      {
        id: '14048',
        title: 'Finished child keeps its branch',
        type: 'decision',
        excerpt: 'The branch is kept after a finish. Second line of the body.',
        createdAt: '2026-10-31 05:00:40'
      }
    ])
  })

  it('reads only the recent observations of a context dump', () => {
    const parsed = parseEngramContext(CONTEXT)
    expect(parsed.map((entry) => entry.title)).toEqual(['First title...', 'Second title', 'Third'])
    expect(parsed[1]).toMatchObject({ type: 'discovery', excerpt: 'Second body.' })
    expect(new Set(parsed.map((entry) => entry.id)).size).toBe(3)
  })
})

describe('readEngramMemories', () => {
  it('asks for the latest memories of the project and keeps the newest few', async () => {
    const run = ok(CONTEXT)
    const result = await readEngramMemories(run, { project: 'demo', limit: 2 })
    expect(run).toHaveBeenCalledWith(['context', 'demo'])
    expect(result.status === 'ok' && result.memories.map((entry) => entry.title)).toEqual([
      'First title...',
      'Second title'
    ])
  })

  it('searches with the query as its own argument and the project and limit flags', async () => {
    const run = ok(SEARCH)
    const result = await readEngramMemories(run, {
      project: 'demo',
      query: '  --all; rm -rf  x ',
      limit: 5
    })
    expect(run).toHaveBeenCalledWith([
      'search',
      'all; rm -rf  x',
      '--project',
      'demo',
      '--limit',
      '5'
    ])
    expect(result.status === 'ok' && result.memories).toHaveLength(2)
  })

  it('treats a blank query as the latest memories', async () => {
    const run = ok(CONTEXT)
    await readEngramMemories(run, { project: 'demo', query: '   ', limit: 5 })
    expect(run).toHaveBeenCalledWith(['context', 'demo'])
  })

  it('is empty, not failed, when nothing matches', async () => {
    const result = await readEngramMemories(ok(`${BANNER}No memories found for: "zzz"\n`), {
      project: 'demo',
      query: 'zzz',
      limit: 5
    })
    expect(result).toEqual({ status: 'ok', memories: [] })
  })

  it('says unavailable when the program is missing', async () => {
    const run: EngramRunner = async () => {
      throw Object.assign(new Error('spawn engram ENOENT'), { code: 'ENOENT' })
    }
    expect(await readEngramMemories(run, { project: 'demo', limit: 5 })).toEqual({
      status: 'unavailable'
    })
  })

  it('fails on a timeout, a non-zero exit, or another start error', async () => {
    const input = { project: 'demo', limit: 5 }
    const timedOut: EngramRunner = async () => ({ code: null, stdout: '', timedOut: true })
    const bad: EngramRunner = async () => ({ code: 1, stdout: '', timedOut: false })
    const boom: EngramRunner = async () => {
      throw new Error('EACCES')
    }
    for (const run of [timedOut, bad, boom]) {
      expect(await readEngramMemories(run, input)).toEqual({ status: 'failed' })
    }
  })
})
