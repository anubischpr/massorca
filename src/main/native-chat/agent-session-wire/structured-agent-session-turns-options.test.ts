// A live option pick rewrites the record's options; the keys Orca owns must survive it.

import { describe, expect, it, vi } from 'vitest'
import { resolveBotRunDenial } from '../../marketplace/marketplace-bot-run-denial'
import type { AgentSessionTurnContext } from './structured-agent-session-turns'
import { performSetOption } from './structured-agent-session-turns-options'

function liveContext(
  persistedOptions: Record<string, string>,
  applied: Record<string, string> | void
): { ctx: AgentSessionTurnContext; saved: () => Record<string, string> } {
  let saved: Record<string, string> = {}
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: performSetOption reads only these members.
  const ctx = {
    sessionId: 'session-1',
    fence: 1,
    adapter: { setOption: vi.fn(async () => applied) },
    persistedOptions,
    persistOptions: async (options: Readonly<Record<string, string>>) => {
      saved = { ...options }
    },
    publish: () => {}
  } as unknown as AgentSessionTurnContext
  return { ctx, saved: () => saved }
}

describe('a live option pick', () => {
  const marked = { accessMode: 'default', botTeamBotId: 'bob', botTeamId: 't1', model: 'old' }

  it.each([
    ['the child reports its options', { model: 'new' }],
    ['the child reports nothing', undefined]
  ])('keeps the bot-run marker when %s', async (_case, applied) => {
    const { ctx, saved } = liveContext(marked, applied)
    expect(await performSetOption(ctx, { key: 'model', value: 'new' })).toMatchObject({ ok: true })
    expect(saved()).toEqual({
      accessMode: 'default',
      botTeamBotId: 'bob',
      botTeamId: 't1',
      model: 'new'
    })
    // The next start still reads the session as the bot's run.
    const listApps = vi.fn(async () => [])
    await resolveBotRunDenial(saved(), listApps)
    expect(listApps).toHaveBeenCalledTimes(1)
  })

  it('does not let the child report or the picked key replace the marker', async () => {
    const { ctx, saved } = liveContext(marked, { botTeamId: 'other' })
    await performSetOption(ctx, { key: 'botTeamBotId', value: 'eve' })
    expect(saved()).toMatchObject({ botTeamBotId: 'bob', botTeamId: 't1' })
  })

  it('adds no marker to a session that is not a bot run', async () => {
    const { ctx, saved } = liveContext({ accessMode: 'default' }, { model: 'new' })
    await performSetOption(ctx, { key: 'model', value: 'new' })
    expect(saved()).toEqual({ accessMode: 'default', model: 'new' })
  })
})
