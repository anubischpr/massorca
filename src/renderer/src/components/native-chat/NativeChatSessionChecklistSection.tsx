import { useState } from 'react'
import { Image as ImageIcon, MessageSquare, Square, SquareCheck, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getIntlLocale } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { useAppStore } from '@/store'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { NativeChatChecklistItem } from '../../../../shared/native-chat-checklist'
import { sendStructuredAgentSessionMessage } from './structured-agent-session-message-sender'
import { NativeChatSessionSection } from './NativeChatSessionSection'
import { NativeChatChecklistAddItem } from './NativeChatChecklistAddItem'
import {
  NativeChatChecklistItemEditor,
  type NativeChatChecklistDraft
} from './NativeChatChecklistItemEditor'
import type { NativeChatAttachmentOwner } from './native-chat-attachment-upload'
import { nativeChatChecklistAttachmentOwner } from './native-chat-checklist-screenshots'
import {
  useNativeChatChecklist,
  type NativeChatChecklistSetItem
} from './use-native-chat-checklist'

/** The message "Send now" sends; the host puts the marks the agent has not seen in front of it. */
const SEND_NOW_TEXT = 'Checklist updated.'

// Why: the chat's own hover-reveal for row actions, so keyboard focus reaches them as well.
const ROW_ACTIONS_REVEAL =
  'transition-opacity can-hover:pointer-events-none can-hover:opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 [.group:has(:focus-visible)_&]:pointer-events-auto [.group:has(:focus-visible)_&]:opacity-100'

function checklistTime(at: number): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: 'numeric', minute: '2-digit' }).format(
    new Date(at)
  )
}

/** The checklist card in the chat summary, under the plan: the agent's items with the person's marks. */
export function NativeChatSessionChecklistSection({
  target,
  sessionId,
  journalItems,
  agentLabel,
  worktreeId
}: {
  target: RuntimeClientTarget
  sessionId: string
  journalItems: readonly AgentJournalRenderItem[]
  /** The chat's agent as the person knows it, such as "Claude". */
  agentLabel: string
  worktreeId: string | null
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const { checklist, writtenAt, readOnly, setItem, addedAt } = useNativeChatChecklist({
    target,
    sessionId,
    journalItems,
    polling: open
  })
  const items = checklist?.items ?? []
  const empty = items.length === 0

  const attachmentOwner = (): NativeChatAttachmentOwner =>
    nativeChatChecklistAttachmentOwner({
      target,
      sessionId,
      worktreeId,
      state: useAppStore.getState()
    })

  const write = async (params: NativeChatChecklistSetItem): Promise<boolean> => {
    const saved = await setItem(params)
    setSaveFailed(!saved)
    return saved
  }

  const toggle = (item: NativeChatChecklistItem): void => {
    void write({ title: checklist?.title ?? null, text: item.text, checked: !item.checked })
  }

  const saveDraft = async (
    item: NativeChatChecklistItem,
    draft: NativeChatChecklistDraft
  ): Promise<boolean> => {
    const saved = await write({
      title: checklist?.title ?? null,
      text: item.text,
      note: draft.note,
      screenshots: draft.screenshots
    })
    if (saved) {
      setEditingKey(null)
    }
    return saved
  }

  const sendNow = (): void => {
    sendStructuredAgentSessionMessage({ sessionId, target, text: SEND_NOW_TEXT })
  }

  const removeOwnItem = (item: NativeChatChecklistItem): void => {
    void write({ text: item.text, remove: true })
  }

  const addOwnItem = (text: string): Promise<boolean> =>
    write({ title: checklist?.title ?? null, text, add: true })

  const markLine = (item: NativeChatChecklistItem): string | null => {
    if (item.by === 'person' && item.at !== null) {
      const time = checklistTime(item.at)
      return item.checked
        ? t('components.nativeChatSummary.checklistCheckedByYou', 'Checked by you · {{time}}', {
            time
          })
        : t('components.nativeChatSummary.checklistUncheckedByYou', 'Unchecked by you · {{time}}', {
            time
          })
    }
    if (item.by === 'agent' && item.at !== null) {
      const time = checklistTime(item.at)
      return item.checked
        ? t(
            'components.nativeChatSummary.checklistCheckedByAgent',
            'Checked by {{agent}} · {{time}}',
            {
              agent: agentLabel,
              time
            }
          )
        : t(
            'components.nativeChatSummary.checklistUncheckedByAgent',
            'Unchecked by {{agent}} · {{time}}',
            { agent: agentLabel, time }
          )
    }
    if (item.noteAt !== null) {
      return t('components.nativeChatSummary.checklistNoteByYou', 'Note by you · {{time}}', {
        time: checklistTime(item.noteAt)
      })
    }
    const added = item.source === 'person' ? addedAt[item.key] : undefined
    return added === undefined
      ? null
      : t('components.nativeChatSummary.checklistAddedByYou', 'Added by you · {{time}}', {
          time: checklistTime(added)
        })
  }

  const nextUnchecked = items.find((item) => !item.checked)
  const fromAgent =
    writtenAt === null
      ? null
      : t('components.nativeChatSummary.checklistFrom', 'from {{agent}}, {{time}}', {
          agent: agentLabel,
          time: checklistTime(writtenAt)
        })
  const subtitle = [checklist?.title, fromAgent].filter(Boolean).join(' · ')
  const unseenCount = checklist?.unseen ?? 0
  const unseenText =
    unseenCount === 1
      ? t(
          'components.nativeChatSummary.checklistUnseenOne',
          '{{count}} change the agent has not seen. It goes with your next message.',
          { count: unseenCount }
        )
      : t(
          'components.nativeChatSummary.checklistUnseenMany',
          '{{count}} changes the agent has not seen. They go with your next message.',
          { count: unseenCount }
        )

  return (
    <NativeChatSessionSection
      title={t('components.nativeChatSummary.checklist', 'Checklist')}
      summary={
        empty
          ? undefined
          : t('components.nativeChatSummary.checklistProgress', '{{checked}} of {{total}}', {
              checked: checklist?.checked ?? 0,
              total: items.length
            })
      }
      compact={
        empty ? (
          <p className="text-foreground">
            {t('components.nativeChatSummary.checklistNone', 'No checklist yet')}
          </p>
        ) : nextUnchecked ? (
          <p className="truncate text-foreground" title={nextUnchecked.text}>
            {nextUnchecked.text}
          </p>
        ) : (
          <p className="text-foreground">
            {t('components.nativeChatSummary.checklistAllChecked', 'All checked')}
          </p>
        )
      }
      openRequest={{ sessionId, surface: 'checklist' }}
      onOpenChange={setOpen}
    >
      {subtitle ? <p className="break-words text-muted-foreground">{subtitle}</p> : null}
      {readOnly ? (
        <p className="text-muted-foreground">
          {t(
            'components.nativeChatSummary.checklistReadOnly',
            'Update the host to check items here.'
          )}
        </p>
      ) : null}
      {empty ? (
        <p className="text-muted-foreground">
          {t(
            'components.nativeChatSummary.checklistEmpty',
            'No checklist yet. Ask the agent for one, or add your own items.'
          )}
        </p>
      ) : null}
      <ul
        aria-label={t('components.nativeChatSummary.checklistItems', 'Checklist items')}
        className="space-y-2"
      >
        {items.map((item) => {
          const mark = markLine(item)
          const addNote = t('components.nativeChatSummary.checklistAddNote', 'Add note')
          const attach = t(
            'components.nativeChatSummary.checklistAttachScreenshot',
            'Attach screenshot'
          )
          const removeLabel = t('components.nativeChatSummary.checklistRemoveItem', 'Remove item')
          return (
            <li key={item.key} className="group space-y-1">
              <div className="flex min-w-0 items-start gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent">
                <button
                  type="button"
                  disabled={readOnly}
                  aria-label={
                    item.checked
                      ? t('components.nativeChatSummary.checklistUncheckItem', 'Uncheck item')
                      : t('components.nativeChatSummary.checklistCheckItem', 'Check item')
                  }
                  onClick={() => toggle(item)}
                  className="mt-0.5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {item.checked ? (
                    <SquareCheck aria-hidden className="size-3.5" />
                  ) : (
                    <Square aria-hidden className="size-3.5" />
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className={cn(
                      'break-words',
                      item.checked ? 'text-muted-foreground line-through' : 'text-foreground'
                    )}
                  >
                    {item.text}
                  </p>
                  {mark ? <p className="text-muted-foreground">{mark}</p> : null}
                </div>
                {readOnly ? null : (
                  <div className={cn('flex shrink-0 items-center gap-0.5', ROW_ACTIONS_REVEAL)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={addNote}
                          onClick={() => setEditingKey(item.key)}
                        >
                          <MessageSquare />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        {addNote}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={attach}
                          onClick={() => setEditingKey(item.key)}
                        >
                          <ImageIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        {attach}
                      </TooltipContent>
                    </Tooltip>
                    {item.source === 'person' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={removeLabel}
                            onClick={() => removeOwnItem(item)}
                          >
                            <X />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={4}>
                          {removeLabel}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                )}
              </div>
              {item.note !== null ? (
                <div className="flex items-start gap-1.5 rounded-md bg-muted px-2 py-1">
                  <MessageSquare
                    aria-hidden
                    className="mt-0.5 size-3 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
                    {item.note}
                  </span>
                </div>
              ) : null}
              {item.screenshots.map((shot) => (
                <div
                  key={shot.path}
                  className="flex min-w-0 items-center gap-2 pl-1 text-muted-foreground"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                    <ImageIcon aria-hidden className="size-3.5" />
                  </span>
                  <span className="min-w-0 truncate text-foreground">{shot.name}</span>
                </div>
              ))}
              {editingKey === item.key ? (
                <NativeChatChecklistItemEditor
                  initialDraft={{ note: item.note ?? '', screenshots: item.screenshots }}
                  attachmentOwner={attachmentOwner}
                  onCancel={() => setEditingKey(null)}
                  onSave={(draft) => saveDraft(item, draft)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
      {readOnly ? null : <NativeChatChecklistAddItem onAdd={addOwnItem} />}
      {saveFailed ? (
        <p role="alert" className="text-destructive">
          {t(
            'components.nativeChatSummary.checklistSaveFailed',
            "Couldn't save the checklist change."
          )}
        </p>
      ) : null}
      {unseenCount > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="min-w-0 text-muted-foreground">{unseenText}</p>
          <Button type="button" variant="outline" size="xs" onClick={sendNow}>
            {t('components.nativeChatSummary.checklistSendNow', 'Send now')}
          </Button>
        </div>
      ) : null}
    </NativeChatSessionSection>
  )
}
