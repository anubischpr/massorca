import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createOsFileDropSequence, useOsFileDropOwner } from '@/hooks/use-os-file-drop-owner'
import { getNativeFileDropRejectionMessage } from '@/lib/native-file-drop-rejection-message'
import { basename } from '@/lib/path'
import {
  NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS,
  NATIVE_CHAT_CHECKLIST_NOTE_MAX_LENGTH,
  type NativeChatChecklistScreenshot
} from '../../../../shared/native-chat-checklist'
import type { NativeChatAttachmentOwner } from './native-chat-attachment-upload'
import { saveNativeChatClipboardImage } from './native-chat-clipboard-image-save'
import { storeNativeChatChecklistScreenshots } from './native-chat-checklist-screenshots'

export type NativeChatChecklistDraft = {
  note: string
  screenshots: NativeChatChecklistScreenshot[]
}

function clipboardHasImage(data: DataTransfer | null): boolean {
  return Array.from(data?.items ?? []).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/')
  )
}

/**
 * The inline editor under a checklist item: its note and screenshots, saved together. Images arrive
 * by the Attach button, a paste, or a drop, and stay in the draft until Save.
 */
export function NativeChatChecklistItemEditor({
  initialDraft,
  attachmentOwner,
  onCancel,
  onSave
}: {
  initialDraft: NativeChatChecklistDraft
  /** Read when an image arrives, so the owner is the chat's current one. */
  attachmentOwner: () => NativeChatAttachmentOwner
  onCancel: () => void
  /** Resolves false when the host did not keep the draft; the editor then stays open. */
  onSave: (draft: NativeChatChecklistDraft) => Promise<boolean>
}): React.JSX.Element {
  const { t } = useTranslation()
  const [note, setNote] = useState(initialDraft.note)
  const [screenshots, setScreenshots] = useState(initialDraft.screenshots)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropSequence] = useState(createOsFileDropSequence)
  const atLimit = screenshots.length >= NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS

  const addScreenshots = (found: NativeChatChecklistScreenshot[]): void => {
    setScreenshots((current) =>
      [...current, ...found].slice(0, NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS)
    )
  }

  const storeAndAdd = async (paths: string[]): Promise<void> => {
    setBusy(true)
    try {
      const stored = await storeNativeChatChecklistScreenshots(paths, attachmentOwner())
      addScreenshots(stored.screenshots)
      setNotice(stored.notice)
    } finally {
      setBusy(false)
    }
  }

  const attachPicked = async (): Promise<void> => {
    const path = await window.api.shell.pickImage().catch(() => null)
    if (path) {
      await storeAndAdd([path])
    }
  }

  const pasteImage = async (): Promise<void> => {
    setBusy(true)
    try {
      const saved = await saveNativeChatClipboardImage(attachmentOwner(), {
        setNotice: (text) => setNotice(text)
      })
      if (saved.status === 'saved') {
        addScreenshots([{ path: saved.tempPath, name: basename(saved.tempPath) }])
      }
    } finally {
      setBusy(false)
    }
  }

  // The nearest drop owner takes the drop, so a drop here never reaches the composer.
  const dropRoot = useRef<HTMLDivElement | null>(null)
  const attachDropOwner = useOsFileDropOwner(dropRoot, {
    consumer: 'agent',
    sequence: dropSequence,
    onDrop: async (prepared) => {
      for (const failure of prepared.failures) {
        const message = getNativeFileDropRejectionMessage(failure)
        toast.error(message.title, { description: message.description })
      }
      if (prepared.paths.length > 0) {
        await storeAndAdd(prepared.paths)
      }
    }
  })

  const save = async (): Promise<void> => {
    setBusy(true)
    const saved = await onSave({ note: note.trim(), screenshots }).catch(() => false)
    setBusy(false)
    if (!saved) {
      setNotice(
        t('components.nativeChatSummary.checklistSaveFailed', "Couldn't save the checklist change.")
      )
    }
  }

  return (
    <div
      ref={attachDropOwner}
      data-native-chat-checklist-editor=""
      onPaste={(event) => {
        if (!clipboardHasImage(event.clipboardData)) {
          return
        }
        event.preventDefault()
        void pasteImage()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onCancel()
        }
      }}
      className="space-y-2 rounded-md border border-border bg-background p-2"
    >
      <div className="space-y-1">
        <label htmlFor="native-chat-checklist-note" className="font-medium text-foreground">
          {t('components.nativeChatSummary.checklistNoteLabel', 'Note')}
        </label>
        <Textarea
          id="native-chat-checklist-note"
          value={note}
          rows={3}
          maxLength={NATIVE_CHAT_CHECKLIST_NOTE_MAX_LENGTH}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {screenshots.length > 0 ? (
        <ul className="space-y-1">
          {screenshots.map((shot, index) => (
            <li key={shot.path} className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <ImageIcon aria-hidden className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{shot.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t(
                  'components.nativeChatSummary.checklistRemoveScreenshot',
                  'Remove screenshot'
                )}
                onClick={() =>
                  setScreenshots((current) => current.filter((_, position) => position !== index))
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || atLimit}
          onClick={() => void attachPicked()}
        >
          <ImageIcon aria-hidden />
          {t('components.nativeChatSummary.checklistAttachScreenshot', 'Attach screenshot')}
        </Button>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('components.nativeChatSummary.checklistCancel', 'Cancel')}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
            {t('components.nativeChatSummary.checklistSave', 'Save')}
          </Button>
        </div>
      </div>
      {notice ? (
        <p role="alert" className="text-destructive">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
