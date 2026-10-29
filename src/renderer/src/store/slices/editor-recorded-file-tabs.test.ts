import { describe, expect, it, vi } from 'vitest'
import { buildRecordedFileTabId } from '@/components/editor/recorded-file-tab'
import { createEditorTabsStore } from './editor-slice-test-harness'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/runtime/close-mirrored-editor-tab', () => ({
  notifyHostOfMirroredEditorClose: vi.fn()
}))

const recordedFile = {
  sessionId: 'session-alpha',
  path: '/home/me/informes/report.html',
  worktreePath: '/remote/repo',
  runtimeEnvironmentId: 'env-1'
}
const tabId = buildRecordedFileTabId('wt-1', recordedFile)

describe('openRecordedFileTab', () => {
  it('opens one read-only recorded-file tab and activates it', () => {
    const store = createEditorTabsStore()
    store.getState().openRecordedFileTab('wt-1', recordedFile)

    expect(store.getState().activeFileId).toBe(tabId)
    expect(store.getState().openFiles).toContainEqual(
      expect.objectContaining({ id: tabId, filePath: tabId, mode: 'recorded-file', recordedFile })
    )
    expect(store.getState().unifiedTabsByWorktree['wt-1']).toContainEqual(
      expect.objectContaining({
        entityId: tabId,
        contentType: 'recorded-file',
        label: 'report.html'
      })
    )
  })

  it('activates the existing tab instead of opening a second copy', () => {
    const store = createEditorTabsStore()
    store.getState().openRecordedFileTab('wt-1', recordedFile)
    store.getState().openRecordedFileTab('wt-1', { ...recordedFile })

    expect(store.getState().openFiles.filter((file) => file.id === tabId)).toHaveLength(1)
    expect(
      store.getState().unifiedTabsByWorktree['wt-1']?.filter((tab) => tab.entityId === tabId)
    ).toHaveLength(1)
  })

  it('gives two chats on the same path their own tabs', () => {
    const store = createEditorTabsStore()
    store.getState().openRecordedFileTab('wt-1', recordedFile)
    store.getState().openRecordedFileTab('wt-1', { ...recordedFile, sessionId: 'session-beta' })

    expect(store.getState().openFiles.filter((file) => file.mode === 'recorded-file')).toHaveLength(
      2
    )
  })

  it('hands a reopened tab the new request, so it reads the host again', () => {
    const store = createEditorTabsStore()
    store.getState().openRecordedFileTab('wt-1', recordedFile)
    const reopened = { ...recordedFile }
    store.getState().openRecordedFileTab('wt-1', reopened)

    expect(store.getState().openFiles.find((file) => file.id === tabId)?.recordedFile).toBe(
      reopened
    )
  })

  it('closes without putting the tab on the reopen stack', () => {
    const store = createEditorTabsStore()
    store.getState().openRecordedFileTab('wt-1', recordedFile)
    store.getState().closeFile(tabId)

    expect(store.getState().openFiles.some((file) => file.id === tabId)).toBe(false)
    expect(
      store.getState().unifiedTabsByWorktree['wt-1']?.some((tab) => tab.entityId === tabId) ?? false
    ).toBe(false)
    expect(store.getState().recentlyClosedEditorTabsByWorktree['wt-1'] ?? []).toEqual([])
  })
})
