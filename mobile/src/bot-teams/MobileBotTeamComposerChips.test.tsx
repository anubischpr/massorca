import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamComposerChips } from './MobileBotTeamComposerChips'
import {
  botTeamDraftMentions,
  type MobileBotTeamDraftMention,
  type MobileBotTeamMentionTarget
} from './mobile-bot-team-mention'

const showAlert = vi.hoisted(() => vi.fn())

vi.mock('react-native', () => ({
  Alert: { alert: showAlert },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ X: 'X' }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'RepoIcon' }))
vi.mock('../components/MobileFileTypeIcon', () => ({ MobileFileTypeIcon: 'FileTypeIcon' }))

const IRIS: MobileBotTeamMentionTarget = {
  name: 'Iris',
  kind: 'bot',
  agent: 'claude',
  character: null
}

function renderChips(
  mentions: readonly MobileBotTeamDraftMention[],
  onRemove = vi.fn()
): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamComposerChips, { mentions, onRemove }))
  })
  return renderer
}

function pressablesLabelled(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    (node) => node.type === 'Pressable' && node.props.accessibilityLabel === label
  )
}

describe('MobileBotTeamComposerChips', () => {
  it('draws nothing when the draft holds no pill', () => {
    expect(renderChips([]).toJSON()).toBeNull()
  })

  it('draws a pill for a picked bot, with an x that hands that mention back', () => {
    const onRemove = vi.fn()
    const mentions = botTeamDraftMentions('hola @Iris mira', [IRIS])
    const renderer = renderChips(mentions, onRemove)

    expect(JSON.stringify(renderer.toJSON())).toContain('Iris')
    act(() => pressablesLabelled(renderer, 'Remove Iris')[0].props.onPress())
    expect(onRemove).toHaveBeenCalledWith(mentions[0])
  })

  it('draws a file pill with its path, and a long press shows the full path', () => {
    const renderer = renderChips(botTeamDraftMentions('ve @site/flyer.html ya', []))

    expect(JSON.stringify(renderer.toJSON())).toContain('site/flyer.html')
    act(() =>
      renderer.root
        .findAll((node) => typeof node.props.onLongPress === 'function')[0]
        .props.onLongPress()
    )
    expect(showAlert).toHaveBeenCalledWith('flyer.html', 'site/flyer.html')
  })
})
