import { describe, expect, it, vi } from 'vitest'
import { MARKETPLACE_AGENT_SWITCH_BLOCKED_MESSAGE } from '../../shared/marketplace-apps'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import { assertBotAgentSwitchAllowed } from './bot-team-agent-switch-guard'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the guard reads only team ids, bot ids and agents.
const TEAMS = [
  {
    id: 't1',
    bots: [
      { id: 'bob', agent: 'claude' },
      { id: 'ana', agent: 'antigravity' }
    ]
  }
] as unknown as BotTeam[]

const blockedFromEngram = vi.fn(async () => ['engram' as const, 'openmetadata' as const])
const blockedFromNothing = vi.fn(async () => [])

describe('putting a bot on Antigravity', () => {
  it('is refused, naming both ways out, when the bot is blocked from a Marketplace app', async () => {
    const switching = assertBotAgentSwitchAllowed(
      { teams: TEAMS, teamId: 't1', botId: 'bob', agent: 'antigravity' },
      blockedFromEngram
    )
    await expect(switching).rejects.toThrow(
      MARKETPLACE_AGENT_SWITCH_BLOCKED_MESSAGE.replace('{{items}}', 'Engram, OpenMetadata')
    )
    await expect(switching).rejects.toThrow(/remove the bot from that blocklist/)
    await expect(switching).rejects.toThrow(/pick another agent/)
    expect(blockedFromEngram).toHaveBeenCalledWith({ botId: 'bob', teamId: 't1' })
  })

  it('is refused for a new bot a team-wide or "only these" rule blocks', async () => {
    await expect(
      assertBotAgentSwitchAllowed(
        { teams: TEAMS, teamId: 't1', botId: '', agent: 'antigravity' },
        blockedFromEngram
      )
    ).rejects.toThrow(/Antigravity can't keep a bot out/)
  })

  it('is allowed when the bot is blocked from nothing', async () => {
    await expect(
      assertBotAgentSwitchAllowed(
        { teams: TEAMS, teamId: 't1', botId: 'bob', agent: 'antigravity' },
        blockedFromNothing
      )
    ).resolves.toBeUndefined()
  })

  it('leaves edits of a bot already on Antigravity, and other agents, unchecked', async () => {
    const denied = vi.fn(async () => ['engram' as const])
    await assertBotAgentSwitchAllowed(
      { teams: TEAMS, teamId: 't1', botId: 'ana', agent: 'antigravity' },
      denied
    )
    await assertBotAgentSwitchAllowed(
      { teams: TEAMS, teamId: 't1', botId: 'bob', agent: 'codex' },
      denied
    )
    expect(denied).not.toHaveBeenCalled()
  })
})
