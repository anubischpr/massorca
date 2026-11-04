import { beforeEach, describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import type { Tab } from '../../../shared/tab-types'
import {
  resetFloatingVisibleTabCountSelectorCacheForTest,
  selectFloatingVisibleTabCount
} from './floating-workspace-panel-selector'

function tab(id: string, contentType: Tab['contentType'], entityId = id): Tab {
  return {
    id,
    entityId,
    groupId: 'g',
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    contentType,
    label: id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

function count(
  tabs: Tab[],
  entities: { terminals?: string[]; browsers?: string[]; files?: string[] } = {}
) {
  return selectFloatingVisibleTabCount({
    tabsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: (entities.terminals ?? []).map((id) => ({ id })) as never
    },
    browserTabsByWorktree: {
      [FLOATING_TERMINAL_WORKTREE_ID]: (entities.browsers ?? []).map((id) => ({ id })) as never
    },
    openFiles: (entities.files ?? []).map((id) => ({
      id,
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID
    })) as never,
    unifiedTabsByWorktree: { [FLOATING_TERMINAL_WORKTREE_ID]: tabs }
  })
}

beforeEach(() => resetFloatingVisibleTabCountSelectorCacheForTest())

describe('the floating workspace item count', () => {
  it('counts a checklist tab, which has no backing record', () => {
    expect(count([tab('c', 'checklist')])).toBe(1)
  })

  it('counts the existing kinds as before: backed ones by their record, self-backed ones always', () => {
    const tabs = [
      tab('t', 'terminal', 'term-1'),
      tab('stale-t', 'terminal', 'gone'),
      tab('b', 'browser', 'browser-1'),
      tab('e', 'editor', 'file-1'),
      tab('stale-e', 'editor', 'gone-file'),
      tab('s', 'simulator'),
      tab('a', 'agent-session')
    ]
    expect(count(tabs, { terminals: ['term-1'], browsers: ['browser-1'], files: ['file-1'] })).toBe(
      5
    )
  })
})
