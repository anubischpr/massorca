import { describe, expect, it } from 'vitest'
import type { NativeChatVisualPickedElement } from './native-chat-visual-annotate'
import type { PrototypeListedDirection } from './rpc-contract/prototype-params'
import { hasNothingToSend, nextVersionOf } from './prototype-set-view'
import { createSetState, editSelected, pickElement, setPrompt } from './prototype-set-state'

function direction(letter: string, versions: number[]): PrototypeListedDirection {
  return {
    letter,
    versions: versions.map((version) => ({
      version,
      fileName: `${letter}-v${version}.html`,
      mtime: version
    }))
  }
}

describe('nextVersionOf', () => {
  it('starts a direction at v2 when it has no version yet', () => {
    expect(nextVersionOf([], 'A')).toBe(2)
    expect(nextVersionOf([direction('A', [])], 'A')).toBe(2)
  })

  it('writes one past the newest version', () => {
    expect(nextVersionOf([direction('A', [1])], 'A')).toBe(2)
    expect(nextVersionOf([direction('A', [1, 2])], 'A')).toBe(3)
  })

  it('compares version numbers, not the order they are listed in', () => {
    expect(nextVersionOf([direction('A', [3, 1, 2])], 'A')).toBe(4)
  })

  it('reads only the iterated direction', () => {
    expect(nextVersionOf([direction('A', [4]), direction('B', [1])], 'B')).toBe(2)
  })

  it('starts a letter the set does not list at v2', () => {
    expect(nextVersionOf([direction('A', [4])], 'C')).toBe(2)
  })
})

function pickedButton(): NativeChatVisualPickedElement {
  return {
    selector: 'button.cta',
    label: 'pay button',
    rect: { x: 10, y: 20, width: 120, height: 40 },
    htmlSnippet: '<button>Pay now</button>',
    state: {
      text: 'Pay now',
      color: '#ffffff',
      bg: '#171717',
      width: { value: 100, unit: '%' },
      height: { value: 48, unit: 'px' },
      fontSize: 14
    }
  }
}

describe('hasNothingToSend', () => {
  it('holds Send while there is no change and no words under "Anything else"', () => {
    const empty = createSetState(['A'])

    expect(hasNothingToSend(empty)).toBe(true)
    expect(hasNothingToSend(setPrompt(empty, '   '))).toBe(true)
    expect(hasNothingToSend(setPrompt(empty, 'Make it bolder.'))).toBe(false)
  })

  it('lets Send through once a pin has a change, even with no words under "Anything else"', () => {
    const pinned = pickElement(createSetState(['A']), pickedButton())

    expect(hasNothingToSend(pinned)).toBe(true)
    expect(hasNothingToSend(editSelected(pinned, { text: 'Pay later' }))).toBe(false)
  })
})
