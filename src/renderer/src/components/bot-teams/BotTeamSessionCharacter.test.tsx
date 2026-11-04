import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BotTeamSessionCharacter, botTeamByTabIdFrom } from './BotTeamSessionCharacter'

describe('BotTeamSessionCharacter', () => {
  it('renders nothing for a session that no bot team started', () => {
    expect(renderToStaticMarkup(<BotTeamSessionCharacter sessionTeam={undefined} />)).toBe('')
  })

  it('renders the team character small and named after the team', () => {
    const markup = renderToStaticMarkup(
      <BotTeamSessionCharacter
        sessionTeam={{ teamId: 't1', teamName: 'Marketing', character: 'circle' }}
      />
    )

    expect(markup).toContain('<svg')
    expect(markup).toContain('width="12"')
    expect(markup).toContain('aria-label="Marketing"')
    expect(markup).toContain('shrink-0')
  })
})

describe('botTeamByTabIdFrom', () => {
  it('keys each agent-session tab by its session id, and skips tabs no bot team started', () => {
    const team = { teamId: 't1', teamName: 'Marketing', character: 'circle' as const }
    const result = botTeamByTabIdFrom(
      {
        'wt-1': [
          { id: 'tab-bot', contentType: 'agent-session', entityId: 'session-bot' },
          { id: 'tab-plain', contentType: 'agent-session', entityId: 'session-plain' },
          { id: 'term-1', contentType: 'terminal', entityId: 'session-bot' }
        ]
      },
      { 'session-bot': team }
    )

    expect(result).toEqual({ 'tab-bot': team })
  })
})
