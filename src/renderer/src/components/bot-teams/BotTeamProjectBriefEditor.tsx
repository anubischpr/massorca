import { Suspense, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RichMarkdownEditor } from '@/components/editor/editor-lazy-views'
import { translate } from '@/i18n/i18n'
import { dropBriefDraft, keepBriefDraft, readBriefDraft } from './bot-team-brief-draft'

/**
 * The project Brief as Markdown in the app's rich editor. Nothing is saved until Save; Cancel
 * puts back the saved text. Unsaved edits are kept per project while the app runs. The editor
 * has no file behind it, so its file-only hooks get empty ids.
 */
export function BotTeamProjectBriefEditor({
  projectId,
  markdown,
  onSave
}: {
  projectId: string
  markdown: string
  /** Resolves true when the Brief was saved. */
  onSave: (markdown: string) => Promise<boolean>
}): React.JSX.Element {
  const [session, setSession] = useState(0)
  const [dirty, setDirty] = useState(() => readBriefDraft(projectId) !== null)
  // Why: the editor opens on the kept draft; only Cancel resets it, so typing never swaps its content.
  const [content, setContent] = useState(() => readBriefDraft(projectId) ?? markdown)
  const draftRef = useRef(content)
  const scope = `bot-team-project-brief:${projectId}`

  const save = async (next: string): Promise<void> => {
    draftRef.current = next
    if (await onSave(next)) {
      dropBriefDraft(projectId)
      setDirty(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <Suspense fallback={<div className="flex-1" />}>
          <RichMarkdownEditor
            key={session}
            fileId={scope}
            viewStateId={scope}
            scrollCacheKey={scope}
            content={content}
            filePath=""
            worktreeId=""
            onContentChange={(next) => {
              draftRef.current = next
              keepBriefDraft(projectId, next, markdown)
            }}
            onDirtyStateHint={setDirty}
            onSave={(next) => void save(next)}
          />
        </Suspense>
      </div>
      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <span className="mr-auto text-xs text-muted-foreground">
            {translate('components.botTeams.briefUnsaved', 'Unsaved changes')}
          </span>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => {
            draftRef.current = markdown
            dropBriefDraft(projectId)
            setContent(markdown)
            setDirty(false)
            setSession((current) => current + 1)
          }}
        >
          {translate('components.botTeams.cancel', 'Cancel')}
        </Button>
        <Button disabled={!dirty} onClick={() => void save(draftRef.current)}>
          {translate('components.botTeams.save', 'Save')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.botTeams.briefEditorHelp',
          'Type / for blocks. Save writes the brief; bots read it when a task starts.'
        )}
      </p>
    </div>
  )
}
