// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { whenBotTeamEditorMounted } from './bot-team-editor-mount'

const editors: Editor[] = []

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})

describe('whenBotTeamEditorMounted', () => {
  it('waits for the view instead of reading it before mount (Tasks crash)', () => {
    const editor = new Editor({ extensions: [StarterKit], element: null })
    editors.push(editor)
    const run = vi.fn()
    expect(() => whenBotTeamEditorMounted(editor, run)).not.toThrow()
    expect(run).not.toHaveBeenCalled()
    const host = document.createElement('div')
    editor.mount(host)
    expect(run).toHaveBeenCalledWith(editor.view.dom)
  })

  it('runs at once on a mounted editor and stops listening on cleanup', () => {
    const editor = new Editor({ extensions: [StarterKit], element: document.createElement('div') })
    editors.push(editor)
    const run = vi.fn()
    const stop = whenBotTeamEditorMounted(editor, run)
    expect(run).toHaveBeenCalledTimes(1)
    stop()
    editor.unmount()
    editor.mount(document.createElement('div'))
    expect(run).toHaveBeenCalledTimes(1)
  })
})
