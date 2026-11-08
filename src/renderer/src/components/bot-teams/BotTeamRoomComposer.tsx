import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
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
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamFileHoverPreview } from './BotTeamFileHoverPreview'
import { BotTeamRoomReplyBar } from './BotTeamRoomReplyBar'
import { useBotTeamRoomDraft } from './bot-team-room-draft'
import { useBotTeamRoomPendingFiles } from './bot-team-room-pending-files'
import { openBotTeamRoomSessions } from './open-bot-team-room-sessions'
import { useBotTeamMentionField } from './use-bot-team-mention-field'

const NO_TEAMS: readonly BotTeam[] = []
const NO_PROJECTS: readonly BotTeamMentionProject[] = []

/** A Reply: the message it quotes above the box, and the bot that wrote it. A new object asks again. */
export type BotTeamRoomReply = { messageId: string; botName: string; quote: string }

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
  /** Resolves true once the host took the text; a reply passes the id of the message it answers. */
  onSend: (
    text: string,
    attachments: BotTeamRoomAttachment[],
    replyToMessageId?: string
  ) => Promise<boolean>
  /** Picks files into the team folder; without it the room takes no files and the "+" stays hidden. */
  onAttachFiles?: () => Promise<BotTeamRoomAttachment[]>
  /** A bot's Reply: its message is quoted above the box, which takes focus. */
  replyTo?: BotTeamRoomReply | null
}): React.JSX.Element {
  const [pending, setPending] = useBotTeamRoomPendingFiles(team.id)
  const [attaching, setAttaching] = useState(false)
  const appliedReply = useRef<BotTeamRoomReply | null>(null)
  const [reply, setReply] = useState<BotTeamRoomReply | null>(null)
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
  // Why: the ref keeps a StrictMode remount from quoting the same reply twice.
  useEffect(() => {
    if (!replyTo || replyTo === appliedReply.current) {
      return
    }
    appliedReply.current = replyTo
    setReply(replyTo)
    editor?.commands.focus('end')
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
    const replied = reply
    // Clears at once, as Workspaces does; a refused send puts the text and files back unless more was added.
    editor.commands.clearContent(true)
    setPending([])
    // Only a send after Reply names a message, so every other send keeps the two-argument call.
    const delivered = replied
      ? await onSend(sent.trim(), files, replied.messageId)
      : await onSend(sent.trim(), files)
    if (!delivered) {
      if (editor.isEmpty) {
        editor.commands.setContent(snapshot, { emitUpdate: true })
      }
      setPending((current) => (current.length === 0 ? files : current))
      return
    }
    setReply((current) => (current === replied ? null : current))
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
                className="flex max-w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs hover:border-ring"
              >
                {/* Why: the same preview a sent file has, so the person checks the file before sending. */}
                <HoverCard openDelay={300}>
                  <HoverCardTrigger asChild>
                    <span className="truncate">{attachment.name}</span>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" align="start" variant="workspace-details">
                    <BotTeamFileHoverPreview
                      teamId={team.id}
                      path={attachment.path}
                      name={attachment.name}
                    />
                  </HoverCardContent>
                </HoverCard>
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
        {reply ? (
          <BotTeamRoomReplyBar
            botName={reply.botName}
            quote={reply.quote}
            onCancel={() => setReply(null)}
          />
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
