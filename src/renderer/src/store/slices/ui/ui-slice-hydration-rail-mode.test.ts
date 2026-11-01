import { describe, expect, it } from 'vitest'
import { hydrateRailMode } from './ui-slice-hydration-rail-mode'

describe('hydrateRailMode', () => {
  it('restores the saved mode and the shown flag', () => {
    expect(
      hydrateRailMode({ railMode: 'bot-teams', railWorkspacesHintShown: true }, 'terminal')
    ).toEqual({
      railMode: 'bot-teams',
      railWorkspacesHintShown: true
    })
  })

  it('starts profiles from before Bot teams in Workspaces with the hint still to show', () => {
    expect(hydrateRailMode({}, 'terminal')).toEqual({
      railMode: 'workspaces',
      railWorkspacesHintShown: false
    })
  })

  it('follows the restored page when it is the Bot teams home', () => {
    expect(hydrateRailMode({ railMode: 'workspaces' }, 'bot-teams').railMode).toBe('bot-teams')
  })

  it('ignores a value it does not know', () => {
    expect(
      hydrateRailMode({ railMode: 'galaxy' as unknown as 'bot-teams' }, 'terminal').railMode
    ).toBe('workspaces')
  })
})
