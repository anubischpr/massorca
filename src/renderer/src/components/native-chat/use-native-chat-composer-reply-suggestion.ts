import { useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { NativeChatComposerInput } from './native-chat-composer-input'
import type { NativeChatReplySuggestionView } from './use-native-chat-reply-suggestion'

export type NativeChatComposerReplySuggestion = {
  text: string
  accept: () => void
  dismiss: () => void
}

/**
 * The host's suggestion as this composer offers it: ghost text over an empty draft, Tab to take it
 * into the draft and Esc to drop it. Typing hides it and clearing the draft shows the same text
 * again, because the suggestion itself is the host's cached copy and nothing here refetches it.
 * Taking it spends nothing: sending the text starts a turn, which is what replaces the suggestion.
 */
export function useNativeChatComposerReplySuggestion(args: {
  offered: NativeChatReplySuggestionView | null | undefined
  draft: string
  /** An attachment, a disabled composer or an open picker owns the input: no ghost text. */
  inputBusy: boolean
  textareaRef: RefObject<NativeChatComposerInput | null>
  setDraft: Dispatch<SetStateAction<string>>
  setCaret: Dispatch<SetStateAction<number>>
}): NativeChatComposerReplySuggestion | null {
  const { offered, draft, inputBusy, textareaRef, setDraft, setCaret } = args
  const visible = offered && draft === '' && !inputBusy ? offered : null
  return useMemo(
    () =>
      visible
        ? {
            text: visible.text,
            dismiss: visible.dismiss,
            accept: () => {
              const input = textareaRef.current
              if (input) {
                input.value = visible.text
                input.setSelectionRange(visible.text.length, visible.text.length)
                input.focus()
              }
              setDraft(visible.text)
              setCaret(visible.text.length)
            }
          }
        : null,
    [setCaret, setDraft, textareaRef, visible]
  )
}
