import { useLayoutEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { composerDraftScopeKey } from '@/lib/composer-draft'
import {
  readNativeChatDraftCache,
  readNativeChatDraftDocument,
  writeNativeChatDraftDocument
} from '../native-chat/native-chat-draft-cache'
import { promptTextContent } from '../native-chat/native-chat-prompt-document-text'
import { promptTextMap } from '../native-chat/native-chat-prompt-document'

/** A room's unsent text, kept under `room:<teamId>`. */
export function useBotTeamRoomDraft(editor: Editor | null, teamId: string): void {
  useBotTeamComposerDraft(editor, `room:${teamId}`)
}

/**
 * Keeps a bot-team field's unsent text in the shared composer draft store under `key`, so it
 * survives leaving the page, a reload and a quit. The editor document is kept too, so picked
 * mentions come back as chips.
 */
export function useBotTeamComposerDraft(editor: Editor | null, key: string): void {
  const scopeKey = composerDraftScopeKey(key)
  useLayoutEffect(() => {
    if (!editor) {
      return
    }
    const text = readNativeChatDraftCache(scopeKey)
    // Why emitUpdate: the composer derives its text and menu from the change, as when typing.
    editor.commands.setContent(
      readNativeChatDraftDocument(scopeKey, text) ?? promptTextContent(text),
      { emitUpdate: true }
    )
    // A sent message clears the editor, and an empty document clears the draft at once.
    const save = ({ editor: current }: { editor: Editor }): void =>
      writeNativeChatDraftDocument(
        scopeKey,
        promptTextMap(current.state.doc).text,
        current.getJSON()
      )
    editor.on('update', save)
    return () => {
      editor.off('update', save)
    }
  }, [editor, scopeKey])
}
