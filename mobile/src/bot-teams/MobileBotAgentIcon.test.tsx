import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'

vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: 'Icon' }))

function iconProps(agentId: string) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotAgentIcon, { agentId, size: 20 }))
  })
  return renderer.root.findByType('Icon' as never).props
}

describe('MobileBotAgentIcon', () => {
  it('draws a bot on pi as Gentle Shell, whose mark is the rose', () => {
    expect(iconProps('pi')).toMatchObject({ agentId: 'pi', piRuntime: 'gentle-shell' })
  })

  it('leaves other agents alone', () => {
    expect(iconProps('claude')).not.toHaveProperty('piRuntime')
  })
})
