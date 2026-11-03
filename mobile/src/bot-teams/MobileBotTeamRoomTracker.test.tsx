import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamSentRequest } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamRequestTracker } from './MobileBotTeamRoomTracker'
import { MobileBotTeamAttachChips } from './MobileBotTeamAttachChips'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ FileText: 'FileText', X: 'X' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))

const WAREHOUSE: BotTeam = {
  id: 'wh',
  name: 'Warehouse',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: []
}
const REQUEST: BotTeamSentRequest = {
  messageId: 'm1',
  task: {
    id: 'wt',
    teamId: 'wh',
    title: 'Count the flyer boxes',
    prompt: '',
    ownerBotId: 'bea',
    sessionId: 'sess',
    projectId: null
  }
}

function render(
  status: Parameters<typeof MobileBotTeamRequestTracker>[0]['status'],
  onOpen = vi.fn()
) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      createElement(MobileBotTeamRequestTracker, {
        request: REQUEST,
        team: WAREHOUSE,
        status,
        offline: false,
        onOpen
      })
    )
  })
  return { renderer, onOpen }
}

const textOf = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

describe('MobileBotTeamRequestTracker', () => {
  it('shows the other team, the task, its live status and Open in', () => {
    const { renderer, onOpen } = render('Working')

    expect(textOf(renderer)).toContain('Warehouse')
    expect(textOf(renderer)).toContain('Count the flyer boxes')
    expect(textOf(renderer)).toContain('Working')
    renderer.root.findByProps({ accessibilityLabel: 'Open in Warehouse' }).props.onPress()
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('keeps an unanswered status neutral, never Working', () => {
    const { renderer } = render('Unknown')

    expect(textOf(renderer)).not.toContain('Working')
    expect(renderer.root.findByProps({ accessibilityLabel: 'Checking status' })).toBeTruthy()
  })
})

describe('MobileBotTeamAttachChips tag', () => {
  it('tags returned files with the team they came from', () => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        createElement(MobileBotTeamAttachChips, {
          files: [{ path: 'attachments/from-warehouse-boxes.xlsx', name: 'boxes.xlsx' }],
          tag: 'From Warehouse'
        })
      )
    })

    expect(textOf(renderer)).toContain('boxes.xlsx')
    expect(textOf(renderer)).toContain('From Warehouse')
  })
})
