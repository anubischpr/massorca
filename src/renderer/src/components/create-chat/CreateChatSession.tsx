import { useRef, useState, type ReactNode } from 'react'
import { useComposerDraft } from '@/lib/composer-draft'
import { CreateChatAgentChip } from './CreateChatAgentChip'
import { CreateChatComposer } from './CreateChatComposer'
import { CreateChatPageFrame } from './CreateChatPageFrame'
import { CreateChatPermissionsChip, CreateChatPlaceChips } from './CreateChatLeftChips'
import { CreateChatSessionViewSwitch } from './CreateChatSessionViewSwitch'
import { CreateChatTerminalNotice } from './CreateChatTerminalNotice'
import { useCreateChatAgents } from './use-create-chat-agents'
import { useCreateChatMentionWorktreeId } from './use-create-chat-mention'
import { useCreateChatModelCatalog } from './use-create-chat-model-catalog'
import {
  buildDefaultCreateChatSelection,
  canSubmitCreateChat,
  createChatTerminalBlock,
  withAvailableCreateChatAgent,
  type CreateChatOptions,
  type CreateChatSelection,
  type CreateChatSessionView,
  type CreateChatSubmit
} from './create-chat-selection'

type CreateChatSessionProps = {
  options: CreateChatOptions
  onSubmit: CreateChatSubmit
  /** Replaces the empty-state heading, for a page that reuses this composer (the Tasks home). */
  heading?: string
  /** Replaces the subheading; null omits it. */
  subheading?: string | null
  /** 'top' pins the heading to the top and lets `below` follow the composer. */
  layout?: 'centered' | 'top'
  /** Centered over the place row; see CreateChatPageFrame. */
  aboveComposer?: ReactNode
  /** Content under the composer. */
  below?: ReactNode
  /** Keeps unsent text when the person clicks away; see useComposerDraft. */
  draftKey?: string
}

/** One create-chat draft; its choices reset with the page's nonce, its unsent text is kept. */
export function CreateChatSession({
  options,
  onSubmit,
  draftKey,
  heading,
  subheading,
  layout = 'centered',
  aboveComposer,
  below
}: CreateChatSessionProps): React.JSX.Element {
  const [selection, setSelection] = useState<CreateChatSelection>(() =>
    buildDefaultCreateChatSelection(options)
  )
  const [draft, setDraft, clearDraft] = useComposerDraft(draftKey ?? null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Why: state updates land after the render, so a second Enter in the same tick would still see canSubmit.
  const inFlight = useRef(false)
  const { agents, piRuntime, modelListingContext } = useCreateChatAgents(selection, options.repos)
  // Derived while rendering: a host that does not offer the picked agent moves it at once.
  const offered = withAvailableCreateChatAgent(selection, agents, options.preferredAgent)
  if (offered !== selection) {
    setSelection(offered)
  }
  const catalog = useCreateChatModelCatalog(
    selection.agent,
    selection.executionHostId,
    modelListingContext
  )
  const mentionWorktreeId = useCreateChatMentionWorktreeId(selection)
  const view: CreateChatSessionView = selection.sessionView ?? 'chat'
  const terminalBlock = view === 'terminal' ? createChatTerminalBlock(selection.agent) : null
  const canSubmit =
    !pending &&
    terminalBlock === null &&
    canSubmitCreateChat(draft, selection, options.repos, options.worktrees)

  const submit = async (): Promise<void> => {
    if (!canSubmit || inFlight.current) {
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const outcome = await onSubmit(draft.trim(), selection)
      if (outcome.started) {
        clearDraft()
      } else {
        setError(outcome.message)
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <CreateChatPageFrame
      heading={heading}
      subheading={subheading}
      layout={layout}
      aboveComposer={aboveComposer}
      below={below}
    >
      <CreateChatComposer
        draft={draft}
        onDraftChange={setDraft}
        canSubmit={canSubmit}
        pending={pending}
        error={error}
        onSubmit={submit}
        mentionWorktreeId={mentionWorktreeId}
        placeChips={
          <CreateChatPlaceChips
            selection={selection}
            options={options}
            onSelectionChange={setSelection}
          />
        }
        footerChips={
          <>
            <CreateChatPermissionsChip
              selection={selection}
              options={options}
              onSelectionChange={setSelection}
            />
            <CreateChatSessionViewSwitch
              view={view}
              onViewChange={(next) => setSelection({ ...selection, sessionView: next })}
            />
          </>
        }
        notice={view === 'terminal' ? <CreateChatTerminalNotice block={terminalBlock} /> : null}
        rightChips={
          <CreateChatAgentChip
            selection={selection}
            agents={agents}
            piRuntime={piRuntime}
            catalog={catalog}
            onSelectionChange={setSelection}
          />
        }
      />
    </CreateChatPageFrame>
  )
}
