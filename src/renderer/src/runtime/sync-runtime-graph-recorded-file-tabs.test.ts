import { describe, expect, it } from 'vitest'
import { buildRecordedFileTabId } from '@/components/editor/recorded-file-tab'
import { buildMobileSessionTabSnapshots } from './sync-runtime-graph'
import { makeState } from './sync-runtime-graph-test-harness'
import type { AppState } from '../store/types'

const recordedFile = {
  sessionId: 'session-alpha',
  path: '/home/me/informes/report.html',
  worktreePath: '/remote/repo',
  runtimeEnvironmentId: 'env-1'
}
const recordedId = buildRecordedFileTabId('wt-1', recordedFile)
const recordedOpenFile: AppState['openFiles'][number] = {
  id: recordedId,
  filePath: recordedId,
  relativePath: recordedFile.path,
  worktreeId: 'wt-1',
  language: 'plaintext',
  isDirty: false,
  mode: 'recorded-file',
  recordedFile
}
const editOpenFile: AppState['openFiles'][number] = {
  id: '/repo/src/app.ts',
  filePath: '/repo/src/app.ts',
  relativePath: 'src/app.ts',
  worktreeId: 'wt-1',
  language: 'typescript',
  isDirty: false,
  mode: 'edit'
}

describe('buildMobileSessionTabSnapshots and recorded-file tabs', () => {
  it('publishes the ordinary file to mobile but never the recorded file', () => {
    const state = makeState({
      browserTabsByWorktree: {},
      tabBarOrderByWorktree: { 'wt-1': [recordedId, editOpenFile.id] },
      openFiles: [recordedOpenFile, editOpenFile]
    })

    const tabs = buildMobileSessionTabSnapshots(state)[0]?.tabs ?? []

    expect(JSON.stringify(tabs)).toContain('/repo/src/app.ts')
    expect(JSON.stringify(tabs)).not.toContain('report.html')
  })
})
