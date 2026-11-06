import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { promptTextMap } from '../native-chat/native-chat-prompt-document'
import {
  BOT_TEAM_ROOM_COMMANDS,
  type BotTeamMentionProject
} from '../../../../shared/bot-team-composer-menu'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../../../shared/bot-team-room-attachments'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import { botTeamComposerChipAttrs } from './bot-team-composer-document'
import { useBotTeamRoomDraft } from './bot-team-room-draft'
import { openBotTeamRoomSessions } from './open-bot-team-room-sessions'
import { useBotTeamMentionField } from './use-bot-team-mention-field'

const NO_TEAMS: readonly BotTeam[] = []
const NO_PROJECTS: readonly BotTeamMentionProject[] = []

/** A reply request: the bot is mentioned once per object, so asking twice for one bot inserts twice. */
export type BotTeamRoomReply = { bot: BotTeamBot }

/** The files already picked, then the new ones not yet listed, up to the message's limit. */
function mergeAttachments(
  current: readonly BotTeamRoomAttachment[],
  added: readonly BotTeamRoomAttachment[]
): BotTeamRoomAttachment[] {
  const merged = [...current]
  for (const attachment of added) {
    if (!merged.some((entry) => entry.path === attachment.path)) {
      merged.push(attachment)
    }
  }
  return merged.slice(0, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
}

/** The room's message box with its @ and / menu; `onSend` resolves true once the host took the text. */
export function BotTeamRoomComposer({
  team,
  otherTeams = NO_TEAMS,
  projects = NO_PROJECTS,
  offline,
  onSend,
  onAttachFiles,
  replyTo = null
}: {
  team: BotTeam
  /** `@Name` of one of these sends the request to that team. */
  otherTeams?: readonly BotTeam[]
  /** The team's projects `@` can name, each with its logo or none. */
  projects?: readonly BotTeamMentionProject[]
  offline: boolean
  onSend: (text: string, attachments: BotTeamRoomAttachment[]) => Promise<boolean>
  /** Picks files into the team folder; without it the room takes no files and the "+" stays hidden. */
  onAttachFiles?: () => Promise<BotTeamRoomAttachment[]>
  /** A bot's Reply: its @ chip goes at the end of the box, which takes focus. */
  replyTo?: BotTeamRoomReply | null
}): React.JSX.Element {
  const [pending, setPending] = useState<BotTeamRoomAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const appliedReply = useRef<BotTeamRoomReply | null>(null)
  const { editor, text, containerRef, menu, field } = useBotTeamMentionField({
    team,
    otherTeams,
    projects,
    commands: BOT_TEAM_ROOM_COMMANDS,
    offline,
    ariaLabel: translate('components.botTeams.messageTeam', 'Message the team'),
    placeholder: offline
      ? translate('components.botTeams.writeWhenBack', 'You can write again when this host is back')
      : translate(
          'components.botTeams.messageTeamHint',
          'Message the team, or type @ to ask one bot'
        ),
    send: () => void send(),
    onCommand: () => void openBotTeamRoomSessions()
  })
  useBotTeamRoomDraft(editor, team.id)
  // Why: the ref keeps a StrictMode remount from inserting the same reply twice.
  useEffect(() => {
    if (!editor || !replyTo || replyTo === appliedReply.current) {
      return
    }
    appliedReply.current = replyTo
    const chip = botTeamComposerChipAttrs({ kind: 'bot', bot: replyTo.bot, insert: '' })
    if (!chip) {
      return
    }
    editor
      .chain()
      .focus('end')
      .insertContent([
        ...(editor.isEmpty ? [] : [{ type: 'text', text: ' ' }]),
        { type: 'botTeamMention', attrs: chip },
        { type: 'text', text: ' ' }
      ])
      .run()
  }, [editor, replyTo])
  // Hoisted: the field's Enter calls it, after the editor exists.
  async function send(): Promise<void> {
    if (!editor) {
      return
    }
    const sent = promptTextMap(editor.state.doc).text
    // Files alone are a valid message, as in Workspaces.
    if (sent.trim() === '' && pending.length === 0) {
      return
    }
    const snapshot = editor.getJSON()
    const files = pending
    // Clears at once, as Workspaces does; a refused send puts the text and files back unless more was added.
    editor.commands.clearContent(true)
    setPending([])
    if (!(await onSend(sent.trim(), files))) {
      if (editor.isEmpty) {
        editor.commands.setContent(snapshot, { emitUpdate: true })
      }
      setPending((current) => (current.length === 0 ? files : current))
    }
  }

  const attach = async (): Promise<void> => {
    if (!onAttachFiles || attaching) {
      return
    }
    setAttaching(true)
    try {
      const added = await onAttachFiles()
      setPending((current) => mergeAttachments(current, added))
    } finally {
      setAttaching(false)
    }
  }

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="mx-auto max-w-[736px]">
        {pending.length > 0 ? (
          <ul
            aria-label={translate('components.botTeams.attachedFiles', 'Attached files')}
            className="mb-1.5 flex flex-wrap gap-1.5"
          >
            {pending.map((attachment) => (
              <li
                key={attachment.path}
                className="flex max-w-full items-center gap-1 rounded-md border border-input px-2 py-0.5 text-xs"
              >
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={translate(
                    'components.botTeams.removeAttachment',
                    'Remove attachment'
                  )}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setPending((current) =>
                      current.filter((entry) => entry.path !== attachment.path)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div
          ref={containerRef}
          className="relative flex items-end gap-2 rounded-xl border border-input p-1.5"
        >
          {menu}
          {onAttachFiles ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              aria-label={translate('components.botTeams.attachFiles', 'Attach files')}
              disabled={offline || attaching}
              onClick={() => void attach()}
            >
              <Plus className="size-4" />
            </Button>
          ) : null}
          {field('scrollbar-sleek max-h-40 min-h-9 flex-1 overflow-y-auto px-2 py-1.5 text-sm')}
          <Button
            size="icon"
            className="rounded-full"
            aria-label={translate('components.botTeams.send', 'Send')}
            disabled={offline || (text.trim() === '' && pending.length === 0)}
            onClick={() => void send()}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
