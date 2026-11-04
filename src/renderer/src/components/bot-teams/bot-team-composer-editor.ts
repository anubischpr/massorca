import { useLayoutEffect, useRef } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import { Slice } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { promptTextContent } from '../native-chat/native-chat-prompt-document-text'
import { BotTeamComposerMention } from './bot-team-composer-mention-node'

/**
 * The room composer's TipTap editor: the Workspaces prompt's document shape, with picked mentions
 * as atoms. Keys stay with the caller, which handles them before ProseMirror sees them.
 */
export function useBotTeamComposerEditor({
  ariaLabel,
  placeholder,
  disabled,
  onChange,
  onSelect
}: {
  ariaLabel: string
  placeholder: string
  disabled: boolean
  onChange: (editor: Editor) => void
  onSelect: (editor: Editor) => void
}): Editor | null {
  const placeholderRef = useRef(placeholder)
  placeholderRef.current = placeholder
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        orderedList: false,
        strike: false,
        underline: false,
        trailingNode: false
      }),
      BotTeamComposerMention,
      Placeholder.configure({ placeholder: () => placeholderRef.current })
    ],
    content: promptTextContent(''),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'combobox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        class:
          'whitespace-pre-wrap break-words outline-none [&_p]:m-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:text-chat-foreground-faint [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none'
      },
      // Clipboard input is literal text, so a pasted "**" or "@Name" stays plain.
      handlePaste: (view, event) => {
        if (event.defaultPrevented) {
          return true
        }
        const text = event.clipboardData?.getData('text/plain')
        if (text == null) {
          return false
        }
        const content = view.state.schema.nodeFromJSON(promptTextContent(text))
        view.dispatch(view.state.tr.replaceSelection(new Slice(content.content, 1, 1)))
        return true
      }
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current),
    onSelectionUpdate: ({ editor: current }) => onSelectRef.current(current)
  })
  // The placeholder recomputes on a transaction, and a prop change makes none.
  useLayoutEffect(() => {
    editor?.setEditable(!disabled, false)
  }, [disabled, editor])
  return editor
}
