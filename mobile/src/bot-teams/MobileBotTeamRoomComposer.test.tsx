import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamRoomComposer } from './MobileBotTeamRoomComposer'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ X: 'X' }))
vi.mock('../session/MobileNativeChatComposer', () => ({ MobileNativeChatComposer: 'Composer' }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'RepoIcon' }))
vi.mock('../components/MobileFileTypeIcon', () => ({ MobileFileTypeIcon: 'FileTypeIcon' }))

const BOT = {
  id: 'iris',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}

function team(id: string, name: string, character: BotTeam['character']): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'full-access',
    bots: [BOT]
  }
}

const ROOM = team('room', 'Marketing', 'circle')
const OTHER = team('other', 'Warehouse', 'square')

function renderComposer(
  value: string,
  onChangeText = vi.fn(),
  onSend = vi.fn(async () => true),
  customSuggestions = vi.fn(() => null)
): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      createElement(MobileBotTeamRoomComposer, {
        team: ROOM,
        teams: [ROOM, OTHER],
        projects: [],
        value,
        onChangeText,
        onSend,
        customSuggestions
      })
    )
  })
  return renderer
}

function pillsLabelled(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    (node) => node.type === 'Pressable' && node.props.accessibilityLabel === label
  )
}

describe('MobileBotTeamRoomComposer', () => {
  it('draws a pill above the composer once a picked bot is in the draft', () => {
    const renderer = renderComposer('@Iris ')

    expect(pillsLabelled(renderer, 'Remove Iris')).toHaveLength(1)
  })

  it('hands the draft, the @ menu and send to the shared composer, set for the room', () => {
    const onSend = vi.fn(async () => true)
    const customSuggestions = vi.fn(() => null)
    const renderer = renderComposer('hola @Iris mira', vi.fn(), onSend, customSuggestions)
    const composer = renderer.root.findByType('Composer')

    expect(composer.props.value).toBe('hola @Iris mira')
    expect(composer.props.onSend).toBe(onSend)
    expect(composer.props.customSuggestions).toBe(customSuggestions)
    expect(composer.props.sendSurfaceId).toBe('room')
    expect(composer.props.placeholder).toBe('Message the team')
    expect(composer.props.layout).toBe('single-line')
  })

  it('takes a pill out of the draft with its mention and the space after it', () => {
    const onChangeText = vi.fn()
    const renderer = renderComposer('hola @Iris mira', onChangeText)

    act(() => pillsLabelled(renderer, 'Remove Iris')[0].props.onPress())
    expect(onChangeText).toHaveBeenCalledWith('hola mira')
  })
})
