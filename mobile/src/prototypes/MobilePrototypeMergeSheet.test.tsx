import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePrototypeMergePlan } from '../../../src/shared/prototype-merge-plan'
import { beginMerge, planArrived } from '../../../src/shared/prototype-merge-state'
import {
  createSetState,
  toggleStar,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { listedSet } from './mobile-prototype-sets.test-fixture'
import { MobilePrototypeMergeSheet } from './MobilePrototypeMergeSheet'
import type { MobileMergePreview } from './use-mobile-prototype-merge-preview'

// The composition is covered on its own; here the sheet is handed each preview state.
const preview = vi.hoisted((): { value: MobileMergePreview } => ({
  value: { html: null, placement: {}, request: null, onResponse: () => undefined, failed: false }
}))

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))
vi.mock('lucide-react-native', () => ({ Check: 'Check', Info: 'Info' }))
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }))
vi.mock('./MobilePrototypeFrame', () => ({
  PROTOTYPE_UNREADABLE_LINE: "Couldn't open this prototype"
}))
vi.mock('./use-mobile-prototype-merge-preview', () => ({
  useMobilePrototypeMergePreview: () => preview.value
}))

const PLAN_JSON = JSON.stringify({
  id: 'plan-1',
  from: ['A', 'C'],
  parts: [
    { name: 'Heading', kind: 'section', selectors: { A: 'main > h1', C: 'main > h1' }, from: 'A' },
    { name: 'Email and card form', kind: 'section', selectors: { C: 'form.pay' }, from: 'C' },
    {
      name: 'Order summary',
      kind: 'section',
      selectors: { A: 'aside.summary', C: 'aside.summary' },
      from: 'A'
    },
    {
      name: 'Pay button',
      kind: 'component',
      selectors: { A: 'button.cta', C: '.checkout .cta' },
      from: 'C'
    }
  ]
})

/** The review of A and C, with the plan's suggestions as they arrived. */
function reviewing(): PrototypeSetState {
  const plan = parsePrototypeMergePlan(PLAN_JSON)
  if (plan === null) {
    throw new Error('expected a valid plan')
  }
  const starred = ['A', 'C'].reduce(toggleStar, createSetState(['A', 'B', 'C']))
  return planArrived(beginMerge(starred, { planId: 'plan-1', baseline: null }), plan, PLAN_JSON)
}

/** A host element by its type name; the mocked native components are host strings. */
function isHost(node: ReactTestInstance, type: string): boolean {
  return node.type === type
}

function flatText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : flatText(child)))
    .join('')
}

function texts(root: ReactTestInstance): string[] {
  return root.findAll((node) => isHost(node, 'Text')).map(flatText)
}

function mount(
  options: { sendFailed?: boolean; onSend?: () => void; state?: PrototypeSetState } = {}
) {
  let state = options.state ?? reviewing()
  const update = vi.fn((transform: (current: PrototypeSetState) => PrototypeSetState) => {
    state = transform(state)
  })
  const element = () => {
    const { merge } = state
    if (merge?.phase !== 'review') {
      throw new Error('the state is not in review')
    }
    return createElement(MobilePrototypeMergeSheet, {
      client: null,
      set: listedSet({ requestId: 'req-1' }),
      review: merge,
      agentName: 'Codex',
      nextLetter: 'D',
      sendFailed: options.sendFailed ?? false,
      update,
      onSend: options.onSend ?? vi.fn()
    })
  }
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(element())
  })
  if (renderer === undefined) {
    throw new Error('the merge sheet did not mount')
  }
  const tree = renderer
  return {
    tree,
    update,
    getState: () => state,
    // The state changed through `update`: draw the sheet again from it.
    rerender: () => {
      act(() => {
        tree.update(element())
      })
    }
  }
}

function tab(root: ReactTestInstance, label: string): ReactTestInstance {
  const found = root
    .findAllByProps({ accessibilityRole: 'tab' })
    .find((node) => flatText(node) === label)
  if (found === undefined) {
    throw new Error(`no ${label} tab`)
  }
  return found
}

function byLabel(root: ReactTestInstance, label: string): ReactTestInstance {
  const [found] = root.findAll(
    (node) => isHost(node, 'Pressable') && node.props.accessibilityLabel === label
  )
  if (found === undefined) {
    throw new Error(`no control labelled ${label}`)
  }
  return found
}

function byLabelGroup(root: ReactTestInstance, group: string, letter: string): ReactTestInstance {
  const [container] = root.findAllByProps({ accessibilityLabel: group })
  const found = container
    ?.findAllByProps({ accessibilityRole: 'button' })
    .find((node) => flatText(node) === letter)
  if (found === undefined) {
    throw new Error(`no ${letter} source in ${group}`)
  }
  return found
}

function webViews(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll((node) => isHost(node, 'WebView'))
}

beforeEach(() => {
  preview.value = {
    html: null,
    placement: {},
    request: null,
    onResponse: () => undefined,
    failed: false
  }
})

describe('the merge sheet header and tabs', () => {
  it('names the merged directions and says who suggested the sources', () => {
    const { tree } = mount()
    expect(texts(tree.root)).toContain('Merge A and C')
    expect(texts(tree.root)).toContain(
      'Codex suggested a source for each part. Change any of them, or leave a part out.'
    )
  })

  it('has Parts and Preview tabs, Parts selected first', () => {
    const { tree } = mount()
    const tabs = tree.root.findAllByProps({ accessibilityRole: 'tab' })
    expect(tabs.map(flatText)).toEqual(['Parts', 'Preview'])
    expect(tabs.map((node) => node.props.accessibilityState)).toEqual([
      { selected: true },
      { selected: false }
    ])
  })

  it('closes the review from the × button, which ends the merge and keeps the stars', () => {
    const { tree, getState } = mount()
    act(() => byLabel(tree.root, 'Close').props.onPress())
    expect(getState().merge).toBeNull()
    expect(getState().starred).toEqual(['A', 'C'])
  })
})

describe('the Parts tab', () => {
  it('lists each part with the selector of its chosen source, its mark and a source of the starred letters', () => {
    const { tree } = mount()
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Heading', 'main > h1', 'Pay button', '.checkout .cta', 'suggested'])
    )
    const group = tree.root.findAllByProps({ accessibilityLabel: 'Source of Heading' })[0]
    const sources = group?.findAllByProps({ accessibilityRole: 'button' }) ?? []
    expect(sources.map(flatText)).toEqual(['A', 'C'])
    expect(sources.map((node) => node.props.accessibilityState)).toEqual([
      { selected: true, disabled: false },
      { selected: false, disabled: false }
    ])
  })

  it('groups the parts under Sections and then Components', () => {
    const { tree } = mount()
    const all = texts(tree.root)
    const at = (text: string) => all.indexOf(text)
    expect(at('Sections')).toBeGreaterThanOrEqual(0)
    expect(at('Sections')).toBeLessThan(at('Heading'))
    expect(at('Heading')).toBeLessThan(at('Components'))
    expect(at('Components')).toBeLessThan(at('Pay button'))
  })

  it('marks a part changed once its source is switched, and suggested again when put back', () => {
    const { tree, getState, rerender } = mount()
    const sourceC = byLabelGroup(tree.root, 'Source of Heading', 'C')
    act(() => sourceC.props.onPress())
    const merge = getState().merge
    expect(merge?.phase === 'review' && merge.parts[0]).toMatchObject({ from: 'C', suggested: 'A' })
    rerender()
    expect(texts(tree.root)).toContain('changed')
  })

  it('shows the selector of the source a part was switched to', () => {
    const { tree, rerender } = mount()
    act(() => byLabelGroup(tree.root, 'Source of Pay button', 'A').props.onPress())
    rerender()
    expect(texts(tree.root)).toContain('button.cta')
    expect(texts(tree.root)).not.toContain('.checkout .cta')
  })

  it('locks the source of a part that exists in one direction, and names its letter in the mark', () => {
    const { tree } = mount()
    const group = tree.root.findAllByProps({
      accessibilityLabel: 'Source of Email and card form'
    })[0]
    const sources = group?.findAllByProps({ accessibilityRole: 'button' }) ?? []
    expect(sources.map(flatText)).toEqual(['C'])
    expect(sources[0]?.props.disabled).toBe(true)
    expect(sources[0]?.props.accessibilityState).toEqual({ selected: true, disabled: true })
    expect(texts(tree.root)).toContain('only in C')
  })

  it('leaves a part out from its checkbox and dims it', () => {
    const { tree, getState, rerender } = mount()
    const box = byLabel(tree.root, 'Order summary')
    expect(box.props.accessibilityRole).toBe('checkbox')
    expect(box.props.accessibilityState).toEqual({ checked: true })
    act(() => box.props.onPress())
    const merge = getState().merge
    expect(merge?.phase === 'review' && merge.parts[2]?.on).toBe(false)
    rerender()
    expect(byLabel(tree.root, 'Order summary').props.accessibilityState).toEqual({ checked: false })
    expect(texts(tree.root)).toContain('left out')
  })

  it('marks a part no preview when the composition could not place it', () => {
    preview.value = { ...preview.value, placement: { 2: 'unmatched' } }
    const { tree } = mount()
    expect(texts(tree.root)).toContain('no preview')
  })
})

describe('the Preview tab', () => {
  it('shows the composed page in a view with scripts off and no network', () => {
    preview.value = { ...preview.value, html: '<p>composed</p>' }
    const { tree } = mount()
    act(() => tab(tree.root, 'Preview').props.onPress())
    const page = webViews(tree.root).find((node) => node.props.javaScriptEnabled === false)
    expect(page?.props.source).toEqual({ html: '<p>composed</p>' })
    expect(page?.props.javaScriptEnabled).toBe(false)
    expect(page?.props.originWhitelist).toEqual(['about:blank'])
    expect(page?.props.onShouldStartLoadWithRequest({ url: 'https://example.com/' })).toBe(false)
    expect(page?.props.onShouldStartLoadWithRequest({ url: 'about:blank' })).toBe(true)
  })

  it('names the preview for the next letter, and shows the approximation note from the info button', () => {
    const { tree } = mount()
    act(() => tab(tree.root, 'Preview').props.onPress())
    const note =
      "This preview is an approximation. Codex generates the final result, and it may vary with the agent's ability."
    expect(texts(tree.root)).toContain('D · preview')
    expect(texts(tree.root)).not.toContain(note)
    act(() => byLabel(tree.root, 'About the preview').props.onPress())
    expect(texts(tree.root)).toContain(note)
  })

  it('shows the one line that cannot open when the composition failed', () => {
    preview.value = { ...preview.value, failed: true }
    const { tree } = mount()
    act(() => tab(tree.root, 'Preview').props.onPress())
    expect(texts(tree.root)).toContain("Couldn't open this prototype")
  })

  it('has the Anything else note on this tab only', () => {
    const { tree, update } = mount()
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Anything else' })).toHaveLength(0)
    act(() => tab(tree.root, 'Preview').props.onPress())
    const [input] = tree.root.findAllByProps({ accessibilityLabel: 'Anything else' })
    expect(input?.props.placeholder).toBe('How the parts should fit together…')
    act(() => input?.props.onChangeText('Keep the header from A.'))
    expect(update).toHaveBeenCalled()
  })
})

describe('the composer', () => {
  it('is hosted with scripts on and no network, and only for the composer page', () => {
    preview.value = {
      ...preview.value,
      request: { requestId: 1, directions: {}, parts: [] }
    }
    const { tree } = mount()
    const composer = webViews(tree.root).find((node) => node.props.javaScriptEnabled === true)
    expect(composer?.props.javaScriptEnabled).toBe(true)
    expect(composer?.props.originWhitelist).toEqual(['about:blank'])
    expect(composer?.props.domStorageEnabled).toBe(false)
    expect(composer?.props.allowFileAccess).toBe(false)
    expect(composer?.props.onShouldStartLoadWithRequest({ url: 'https://example.com/' })).toBe(
      false
    )
  })
})

describe('under both tabs', () => {
  it('keeps Merge into the next letter in a footer, outside the scrolling list, under both tabs', () => {
    const { tree } = mount()
    const sendButtons = (root: ReactTestInstance) =>
      root.findAll((node) => isHost(node, 'Pressable') && flatText(node) === 'Merge into D')
    for (const label of ['Parts', 'Preview']) {
      act(() => tab(tree.root, label).props.onPress())
      const [scroll] = tree.root.findAll((node) => isHost(node, 'ScrollView'))
      expect(sendButtons(tree.root)).toHaveLength(1)
      expect(scroll === undefined ? [] : sendButtons(scroll)).toHaveLength(0)
    }
  })

  it('lets the list scroll with no cap on its height, so no option is cut off', () => {
    const { tree } = mount()
    const [scroll] = tree.root.findAll((node) => isHost(node, 'ScrollView'))
    expect(scroll?.props.style).toEqual(expect.objectContaining({ flexShrink: 1 }))
    expect(scroll?.props.style).not.toHaveProperty('maxHeight')
  })

  it('sends from Merge into D', () => {
    const onSend = vi.fn()
    const { tree } = mount({ onSend })
    const send = (): ReactTestInstance => {
      const [button] = tree.root.findAll(
        (node) => isHost(node, 'Pressable') && node.props.onPress === onSend
      )
      if (button === undefined) {
        throw new Error('no send button')
      }
      return button
    }
    expect(send().props.disabled).toBe(false)
    act(() => send().props.onPress())
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('holds Merge into D while no part is kept', () => {
    const onSend = vi.fn()
    const { tree, rerender } = mount({ onSend })
    for (const name of ['Heading', 'Email and card form', 'Order summary', 'Pay button']) {
      act(() => byLabel(tree.root, name).props.onPress())
      rerender()
    }
    const [button] = tree.root.findAll(
      (node) => isHost(node, 'Pressable') && node.props.onPress === onSend
    )
    expect(button?.props.disabled).toBe(true)
  })

  it('says the send was refused, with the draft kept', () => {
    const refused = mount({ sendFailed: true })
    const alert = refused.tree.root.findAllByProps({ accessibilityRole: 'alert' })
    expect(alert.map(flatText)).toEqual([
      "Couldn't send: the chat is no longer active. Your draft is kept."
    ])
    expect(mount().tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0)
  })
})
