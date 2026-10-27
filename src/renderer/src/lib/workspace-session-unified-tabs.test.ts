import { describe, expect, it } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'
import { buildRecordedFileTabId } from '@/components/editor/recorded-file-tab'
import type { Tab, TabGroup, TabGroupLayoutNode } from '../../../shared/tab-types'
import { buildEditorSessionData } from './workspace-session'
import { buildPersistedUnifiedTabSessionData } from './workspace-session-unified-tabs'

const recordedFile = {
  sessionId: 'session-alpha',
  path: '/home/me/informes/report.html',
  worktreePath: '/remote/repo',
  runtimeEnvironmentId: 'env-1'
}
const recordedId = buildRecordedFileTabId('wt-1', recordedFile)

function tab(id: string, contentType: Tab['contentType']): Tab {
  return {
    id,
    entityId: id,
    groupId: 'group-1',
    worktreeId: 'wt-1',
    contentType,
    label: id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

describe('saved session never carries a recorded-file tab', () => {
  it('drops the tab and its group slot, keeping the other tabs', () => {
    const group: TabGroup = {
      id: 'group-1',
      worktreeId: 'wt-1',
      activeTabId: recordedId,
      tabOrder: ['terminal', recordedId, 'check'],
      recentTabIds: [recordedId, 'terminal']
    }
    const layout: TabGroupLayoutNode = { type: 'leaf', groupId: 'group-1' }

    const persisted = buildPersistedUnifiedTabSessionData({
      activeGroupIdByWorktree: { 'wt-1': 'group-1' },
      groupsByWorktree: { 'wt-1': [group] },
      layoutByWorktree: { 'wt-1': layout },
      unifiedTabsByWorktree: {
        'wt-1': [
          tab('terminal', 'terminal'),
          tab(recordedId, 'recorded-file'),
          tab('check', 'check-details')
        ]
      }
    })

    expect(persisted.unifiedTabs?.['wt-1']?.map((saved) => saved.id)).toEqual(['terminal', 'check'])
    expect(persisted.tabGroups?.['wt-1']?.[0]?.tabOrder).toEqual(['terminal', 'check'])
    expect(persisted.tabGroups?.['wt-1']?.[0]?.activeTabId).toBeNull()
    expect(persisted.tabGroups?.['wt-1']?.[0]?.recentTabIds).toEqual(['terminal'])
  })

  it('keeps recorded-file editors and their active pointer out of the saved editor state', () => {
    const openFiles: OpenFile[] = [
      {
        id: recordedId,
        filePath: recordedId,
        relativePath: recordedFile.path,
        worktreeId: 'wt-1',
        language: 'plaintext',
        isDirty: false,
        mode: 'recorded-file',
        recordedFile
      },
      {
        id: '/repo/src/app.ts',
        filePath: '/repo/src/app.ts',
        relativePath: 'src/app.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'edit'
      }
    ]

    const session = buildEditorSessionData(
      openFiles,
      {},
      {},
      { 'wt-1': recordedId },
      { 'wt-1': 'editor' }
    )

    expect(session.openFilesByWorktree?.['wt-1']?.map((file) => file.filePath)).toEqual([
      '/repo/src/app.ts'
    ])
    expect(session.activeFileIdByWorktree).toEqual({})
    expect(session.activeTabTypeByWorktree).toEqual({})
  })
})
