import { describe, expect, it } from 'vitest'
import { editFilesFromToolPair } from './native-chat-edit-normalize'
import { editedPathsFromToolPair } from './native-chat-edit-paths'

// Shapes taken from a preview host's structured journal (tool-call bodies, state completed).
const GENTLE_WRITE = {
  name: 'write',
  input: { path: 'resultados/gentle-demo.md', content: '# Demo\nline\n' },
  state: 'completed' as const,
  result: { output: 'Successfully wrote 12 bytes', isError: false }
}
const GENTLE_EDIT = {
  name: 'edit',
  input: {
    path: 'resultados/gentle-demo.md',
    edits: [{ oldText: 'line', newText: 'changed line' }]
  },
  state: 'completed' as const
}
const AGY_WRITE = {
  name: 'write_file',
  input: { Path: '/work/resultados/agy-demo.md' },
  state: 'completed' as const
}
const AGY_EDIT = { ...AGY_WRITE, name: 'edit_file' }

describe('Gentle Shell file tools', () => {
  it('draws a whole-file card for write and a snippet card for edit', () => {
    expect(editFilesFromToolPair(GENTLE_WRITE)?.[0]).toMatchObject({
      path: 'resultados/gentle-demo.md'
    })
    const edit = editFilesFromToolPair(GENTLE_EDIT)?.[0]
    expect(edit?.path).toBe('resultados/gentle-demo.md')
    expect(edit?.lines.some((line) => line.kind === 'add' && line.text === 'changed line')).toBe(
      true
    )
  })

  it('lists each changed path', () => {
    expect(editedPathsFromToolPair(GENTLE_WRITE)).toEqual(['resultados/gentle-demo.md'])
    expect(editedPathsFromToolPair(GENTLE_EDIT)).toEqual(['resultados/gentle-demo.md'])
  })

  it('counts neither a failed nor a still-running mutation', () => {
    expect(editedPathsFromToolPair({ ...GENTLE_WRITE, state: 'failed' })).toEqual([])
    expect(editedPathsFromToolPair({ ...GENTLE_EDIT, state: 'running' })).toEqual([])
  })
})

describe('Antigravity file tools', () => {
  it('lists the path the content-less step names', () => {
    expect(editedPathsFromToolPair(AGY_WRITE)).toEqual(['/work/resultados/agy-demo.md'])
    expect(editedPathsFromToolPair(AGY_EDIT)).toEqual(['/work/resultados/agy-demo.md'])
    expect(
      editedPathsFromToolPair({
        name: 'replace_file_content',
        input: { TargetFile: '/work/a.ts' },
        state: 'completed'
      })
    ).toEqual(['/work/a.ts'])
  })

  it('draws no card without content, leaving the generic tool view', () => {
    expect(editFilesFromToolPair(AGY_WRITE)).toBeNull()
  })

  it('counts neither a failed nor a running step, and never a read', () => {
    expect(editedPathsFromToolPair({ ...AGY_WRITE, state: 'failed' })).toEqual([])
    expect(editedPathsFromToolPair({ ...AGY_EDIT, state: 'running' })).toEqual([])
    expect(
      editedPathsFromToolPair({ name: 'view_file', input: { Path: '/a' }, state: 'completed' })
    ).toEqual([])
    expect(
      editedPathsFromToolPair({ name: 'read', input: { path: 'a' }, state: 'completed' })
    ).toEqual([])
  })
})
