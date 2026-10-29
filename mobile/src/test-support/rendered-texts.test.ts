import type { ReactTestRendererJSON } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'
import { renderedTexts } from './rendered-texts'

describe('renderedTexts', () => {
  it('reads a nested Text as part of its parent words', () => {
    const tree: ReactTestRendererJSON = {
      type: 'Text',
      props: {},
      children: ['Picks ', { type: 'Text', props: {}, children: ['Codex'] }, ' now']
    }

    expect(renderedTexts(tree)).toEqual(['Picks Codex now'])
  })

  it('reads each Text under a View as its own entry', () => {
    const tree: ReactTestRendererJSON = {
      type: 'View',
      props: {},
      children: [
        { type: 'Text', props: {}, children: ['Start'] },
        { type: 'View', props: {}, children: [{ type: 'Text', props: {}, children: ['Cancel'] }] }
      ]
    }

    expect(renderedTexts(tree)).toEqual(['Start', 'Cancel'])
  })
})
