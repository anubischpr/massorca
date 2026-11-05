/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { describe, expect, it } from 'vitest'
import { useBotTeamComposerDraft } from './bot-team-room-draft'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Probe({ editor }: { editor: Editor }): null {
  useBotTeamComposerDraft(editor, 'tasks:bot-team')
  return null
}

describe('useBotTeamComposerDraft', () => {
  it('skips an editor that was already destroyed instead of crashing the page', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text] })
    editor.destroy()
    const container = document.createElement('div')
    const root = createRoot(container)
    expect(() => act(() => root.render(<Probe editor={editor} />))).not.toThrow()
    act(() => root.unmount())
  })
})
