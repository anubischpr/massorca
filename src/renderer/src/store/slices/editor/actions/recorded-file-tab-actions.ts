import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'
import {
  buildRecordedFileTabId,
  getRecordedFileTabLabel
} from '@/components/editor/recorded-file-tab'
import type { OpenFile } from '../types/open-file'
import { openWorkspaceEditorItem } from '../tabs/workspace-editor-item'

export function createRecordedFileTabActions(
  set: EditorSet,
  get: EditorGet
): Pick<EditorSlice, 'openRecordedFileTab'> {
  return {
    openRecordedFileTab: (worktreeId, recordedFile) => {
      const id = buildRecordedFileTabId(worktreeId, recordedFile)
      const label = getRecordedFileTabLabel(recordedFile.path)
      set((s) => {
        const existing = s.openFiles.some((file) => file.id === id)
        // Why: a fresh request object makes the tab re-read the host, so reopening retries an earlier failure.
        const openFiles: OpenFile[] = existing
          ? s.openFiles.map((file) => (file.id === id ? { ...file, recordedFile } : file))
          : [
              ...s.openFiles,
              {
                id,
                filePath: id,
                relativePath: recordedFile.path,
                worktreeId,
                language: 'plaintext',
                isDirty: false,
                mode: 'recorded-file',
                recordedFile
              }
            ]
        return {
          openFiles,
          activeFileId: id,
          activeTabType: 'editor',
          activeFileIdByWorktree: { ...s.activeFileIdByWorktree, [worktreeId]: id },
          activeTabTypeByWorktree: { ...s.activeTabTypeByWorktree, [worktreeId]: 'editor' }
        }
      })
      void openWorkspaceEditorItem(get(), id, worktreeId, label, 'recorded-file')
    }
  }
}
