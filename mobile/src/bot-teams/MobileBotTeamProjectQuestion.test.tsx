import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamProjectQuestion } from './MobileBotTeamProjectQuestion'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))

const PROJECT: BotTeamProject = {
  id: 'launch',
  teamId: 'team',
  name: 'Launch',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}

function renderQuestion(
  onAnswer: (projectId: string | null) => void,
  busy = false
): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      createElement(MobileBotTeamProjectQuestion, { projects: [PROJECT], busy, onAnswer })
    )
  })
  return renderer
}

function press(renderer: ReactTestRenderer, label: string): void {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.children.includes(label)).length > 0
  )[0]
  act(() => target.props.onPress())
}

describe('MobileBotTeamProjectQuestion', () => {
  it('asks which project the request is for, with no project picked first', () => {
    const onAnswer = vi.fn()
    const renderer = renderQuestion(onAnswer)

    expect(JSON.stringify(renderer.toJSON())).toContain('Which project is this for?')
    expect(JSON.stringify(renderer.toJSON())).toContain('No project')
    press(renderer, 'Continue')
    expect(onAnswer).toHaveBeenCalledWith(null)
  })

  it('answers with the project the person picks', () => {
    const onAnswer = vi.fn()
    const renderer = renderQuestion(onAnswer)

    press(renderer, 'Launch')
    press(renderer, 'Continue')
    expect(onAnswer).toHaveBeenCalledWith('launch')
  })

  it('holds the answer while the request is being filed', () => {
    const renderer = renderQuestion(vi.fn(), true)
    const continueButton = renderer.root.findByProps({ accessibilityLabel: 'Continue' })

    expect(continueButton.props.disabled).toBe(true)
  })
})
