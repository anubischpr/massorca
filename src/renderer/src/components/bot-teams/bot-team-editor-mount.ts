import type { Editor } from '@tiptap/core'

/**
 * Runs `run` with the editor's DOM once its view exists: now, or on mount. Before mount TipTap's
 * view is a stand-in that throws on `dom`, which crashed the Tasks page on its first paint.
 */
export function whenBotTeamEditorMounted(
  editor: Editor,
  run: (dom: HTMLElement) => void
): () => void {
  const apply = (): void => {
    // The stand-in view has no `dom` key; a mounted EditorView owns one.
    if (!editor.isDestroyed && 'dom' in editor.view) {
      run(editor.view.dom)
    }
  }
  apply()
  editor.on('mount', apply)
  return () => {
    editor.off('mount', apply)
  }
}
