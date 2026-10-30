import { describe, expect, it } from 'vitest'
import {
  PROTOTYPE_FRAMES_LINE,
  prototypeDesignBrief,
  PROTOTYPE_VERSION_CRAFT_LINE
} from './prototype-design-brief'
import { PROTOTYPE_FRAMES } from './prototype-frames'
import {
  buildPrototypeIterationInstruction,
  buildPrototypeRequestMessage,
  type PrototypeAgent
} from './prototype-request'
import { splitTrustedPrototypeHiddenInstruction } from './prototype-hidden-instruction'

const REQUEST_ID = '20261030-090000-abc123'
const FOLDER = `/w/prototypes/${REQUEST_ID}`

function sentTo(agent: PrototypeAgent, text = 'Make a mockup of the pricing page'): string {
  return buildPrototypeRequestMessage({
    text,
    agent,
    count: 3,
    requestId: REQUEST_ID,
    folderPath: FOLDER
  }).sentText
}

describe('prototypeDesignBrief', () => {
  it('names the sizes the viewer really renders', () => {
    const { desktop, phone } = PROTOTYPE_FRAMES
    expect(PROTOTYPE_FRAMES_LINE).toContain(`${desktop.width}x${desktop.height}`)
    expect(PROTOTYPE_FRAMES_LINE).toContain(`${phone.width}x${phone.height}`)
    expect(PROTOTYPE_VERSION_CRAFT_LINE).toContain(`${desktop.width}x${desktop.height}`)
    expect(PROTOTYPE_VERSION_CRAFT_LINE).toContain(`${phone.width}x${phone.height}`)
  })

  it('asks directions to differ only when there are several', () => {
    expect(prototypeDesignBrief(3)).toContain('Directions: each must be a different answer')
    expect(prototypeDesignBrief(1)).not.toContain('Directions:')
  })

  it('stays compact enough to send with every request', () => {
    expect(prototypeDesignBrief(3).length).toBeLessThan(3200)
  })

  it('lets the project design system override its own type and color choices', () => {
    expect(prototypeDesignBrief(2)).toMatch(/design system, theme or tokens.*override/u)
  })
})

describe('the brief in what agents receive', () => {
  it.each<PrototypeAgent>(['claude', 'codex', 'antigravity', 'gentle-shell', 'other'])(
    'reaches %s hidden from the chat',
    (agent) => {
      const message = buildPrototypeRequestMessage({
        text: '/prototype a pricing page',
        agent,
        count: 2,
        requestId: REQUEST_ID,
        folderPath: FOLDER
      })
      expect(message.sentText).toContain(PROTOTYPE_FRAMES_LINE)
      expect(message.visibleText).not.toContain(PROTOTYPE_FRAMES_LINE)
      expect(splitTrustedPrototypeHiddenInstruction(message.sentText).visibleText).toBe(
        '/prototype a pricing page'
      )
    }
  )

  it('reaches the native design command of Gentle Shell', () => {
    expect(sentTo('gentle-shell', '/gentle:design a pricing page')).toContain(PROTOTYPE_FRAMES_LINE)
  })

  it('reminds an iteration of the floors, after the line that makes it trusted', () => {
    const lines = buildPrototypeIterationInstruction({
      requestId: REQUEST_ID,
      letter: 'B',
      nextVersion: 2,
      folderPath: FOLDER
    }).split('\n')
    expect(lines[1]).toMatch(/^Write the new version of direction B as /u)
    expect(lines[2]).toBe(PROTOTYPE_VERSION_CRAFT_LINE)
  })
})
