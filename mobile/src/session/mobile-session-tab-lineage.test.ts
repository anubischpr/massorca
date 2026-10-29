import { describe, expect, it } from 'vitest'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { MobileSessionTab } from './mobile-session-route-types'
import {
  groupSessionRowsByParent,
  mobileSessionChildParentTabIds
} from './mobile-session-tab-lineage'

const parentChat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-parent',
  title: 'Gentle Shell v5',
  sessionId: 'parent-1',
  agent: 'claude',
  isActive: true
}
const childChat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-child',
  title: 'Explore Gentle Shell v5',
  sessionId: 'child-1',
  agent: 'codex',
  isActive: false
}
const grandchildChat: MobileSessionTab = {
  type: 'agent-session',
  id: 'tab-grandchild',
  title: 'Nested',
  sessionId: 'grandchild-1',
  agent: 'codex',
  isActive: false
}
const leafOne: MobileSessionTab = {
  type: 'terminal',
  id: 'term-tab-1',
  parentTabId: 'term-tab',
  leafId: '11111111-1111-4111-8111-111111111111',
  title: 'shell',
  terminal: 'h1',
  isActive: false
}
const leafTwo: MobileSessionTab = {
  ...leafOne,
  id: 'term-tab-2',
  leafId: '22222222-2222-4222-8222-222222222222'
}

function paneOf(sessionId: string, leaf: string): string {
  return `${structuredAgentSessionTabId(sessionId)}:${leaf}`
}

const LEAF = '33333333-3333-4333-8333-333333333333'

describe('mobileSessionChildParentTabIds', () => {
  it('nests a child chat under the chat that spawned its pane', () => {
    const parents = mobileSessionChildParentTabIds(
      [parentChat, childChat],
      [
        { paneKey: paneOf('parent-1', LEAF), parentPaneKey: null },
        { paneKey: paneOf('child-1', LEAF), parentPaneKey: paneOf('parent-1', LEAF) }
      ]
    )

    expect([...parents]).toEqual([['tab-child', 'tab-parent']])
  })

  it('nests a child under the terminal leaf that spawned it, not a sibling leaf', () => {
    const parents = mobileSessionChildParentTabIds(
      [leafOne, leafTwo, childChat],
      [{ paneKey: paneOf('child-1', LEAF), parentPaneKey: `term-tab:${leafTwo.leafId}` }]
    )

    expect([...parents]).toEqual([['tab-child', 'term-tab-2']])
  })

  it('keeps a grandchild flat, so nesting stops at one level', () => {
    const parents = mobileSessionChildParentTabIds(
      [parentChat, childChat, grandchildChat],
      [
        { paneKey: paneOf('child-1', LEAF), parentPaneKey: paneOf('parent-1', LEAF) },
        { paneKey: paneOf('grandchild-1', LEAF), parentPaneKey: paneOf('child-1', LEAF) }
      ]
    )

    expect([...parents]).toEqual([['tab-child', 'tab-parent']])
  })

  it('ignores a self parent and a parent pane with no tab here', () => {
    const parents = mobileSessionChildParentTabIds(
      [childChat],
      [
        { paneKey: paneOf('child-1', LEAF), parentPaneKey: paneOf('child-1', LEAF) },
        { paneKey: paneOf('child-1', LEAF), parentPaneKey: paneOf('gone-1', LEAF) }
      ]
    )

    expect(parents.size).toBe(0)
  })
})

describe('groupSessionRowsByParent', () => {
  const row = (tab: MobileSessionTab) => ({ tab, isActive: false, status: null })

  it('puts each child after its parent and lists no child as a root', () => {
    const rows = [row(parentChat), row(childChat), row(leafOne)]
    const groups = groupSessionRowsByParent(rows, new Map([['tab-child', 'tab-parent']]))

    expect(groups.map((group) => group.row.tab.id)).toEqual(['tab-parent', 'term-tab-1'])
    expect(groups[0]?.children.map((child) => child.tab.id)).toEqual(['tab-child'])
    expect(groups[1]?.children).toEqual([])
  })

  it('keeps a child as a root when its parent is not in the list', () => {
    const groups = groupSessionRowsByParent(
      [row(childChat)],
      new Map([['tab-child', 'tab-missing']])
    )

    expect(groups.map((group) => group.row.tab.id)).toEqual(['tab-child'])
  })
})
