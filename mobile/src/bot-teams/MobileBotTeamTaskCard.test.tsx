import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: () => null }))
vi.mock('./MobileBotTeamReassignSheet', () => ({ MobileBotTeamReassignSheet: () => null }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
  })
}))

const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    {
      id: 'bot',
      name: 'Iris',
      job: '',
      agent: 'claude',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}

const TASK: BotTeamTask = {
  id: 'task_1',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: 's1',
  projectId: null
}

function renderCard(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      createElement(MobileBotTeamTaskCard, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the status feed is mocked and never reads the client.
        client: {} as RpcClient,
        task: TASK,
        team: TEAM,
        offline: false,
        onOpen: () => {}
      })
    )
  })
  if (!renderer) {
    throw new Error('card did not render')
  }
  return renderer
}

describe('a task card while the host has not answered', () => {
  it('shows a placeholder, not the raw status word', () => {
    const renderer = renderCard()
    const rendered = JSON.stringify(renderer.toJSON())

    expect(rendered).not.toContain('Unknown')
    expect(rendered).not.toContain('Working')
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Checking status')
    ).toHaveLength(1)
  })
})
