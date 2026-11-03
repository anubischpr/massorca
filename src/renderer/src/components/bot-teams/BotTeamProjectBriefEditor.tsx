import { Suspense, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RichMarkdownEditor } from '@/components/editor/editor-lazy-views'
import { translate } from '@/i18n/i18n'

/**
 * The project Brief as Markdown in the app's rich editor. Nothing is saved until Save; Cancel
 * puts back the saved text. The editor has no file behind it, so its file-only hooks get empty ids.
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
  const [dirty, setDirty] = useState(false)
  const draftRef = useRef(markdown)
  const scope = `bot-team-project-brief:${projectId}`

  const save = async (next: string): Promise<void> => {
    draftRef.current = next
    if (await onSave(next)) {
      setDirty(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-72 overflow-hidden rounded-xl border border-border bg-card">
        <Suspense fallback={<div className="min-h-72" />}>
          <RichMarkdownEditor
            key={session}
            fileId={scope}
            viewStateId={scope}
            scrollCacheKey={scope}
            content={markdown}
            filePath=""
            worktreeId=""
            onContentChange={(next) => {
              draftRef.current = next
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
