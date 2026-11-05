import type { MarketplaceAppId } from '../../../../shared/marketplace-apps'

/** A picked @ item: `token` is the text it sends, `label` what its chip shows. */
export type NativeChatMentionChip = {
  token: string
  label: string
  kind: 'file' | 'app' | 'project'
  appId?: MarketplaceAppId
}

/** Text coordinates keep transport, attachments, and picker logic independent of the editor. */
export type NativeChatComposerInput = Pick<
  HTMLTextAreaElement,
  | 'value'
  | 'selectionStart'
  | 'selectionEnd'
  | 'disabled'
  | 'focus'
  | 'select'
  | 'setSelectionRange'
> & {
  contains?: (node: Node | null) => boolean
  insertText?: (text: string) => void
  insertSkill?: (from: number, to: number, token: string) => void
  /** Replaces the text between `from` and `to` with a picked file or app chip and a space. */
  insertMention?: (from: number, to: number, mention: NativeChatMentionChip) => void
  /** Whether a collapsed caret sits on the first (`start`) or last (`end`) visual line,
   *  counting wrapped lines, so an arrow key there has nowhere left to move it. */
  isCaretOnVisualEdge?: (edge: 'start' | 'end') => boolean
}

/** `/mention` and `/open`: an `@` and its query at the caret, which opens the file picker as typing `@` does. */
export function insertNativeChatMention(
  input: NativeChatComposerInput | null,
  query: string
): void {
  if (!input || input.disabled || !input.insertText) {
    return
  }
  input.focus()
  input.insertText(`@${query}`)
}

export function insertNativeChatPastedText(
  input: NativeChatComposerInput | null,
  text: string
): boolean {
  if (!input || input.disabled || !input.insertText) {
    return false
  }
  // A paste routed from a hidden terminal or a transcript click must leave the caret in the composer.
  input.focus()
  input.insertText(text)
  return true
}
