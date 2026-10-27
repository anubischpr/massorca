import { useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { CreateChatAgentChip } from './CreateChatAgentChip'
import { CreateChatComposer } from './CreateChatComposer'
import { CreateChatLeftChips } from './CreateChatLeftChips'
import { useCreateChatModelCatalog } from './use-create-chat-model-catalog'
import {
  buildDefaultCreateChatSelection,
  canSubmitCreateChat,
  type CreateChatOptions,
  type CreateChatSelection,
  type CreateChatSubmit
} from './create-chat-selection'

type CreateChatSessionProps = {
  options: CreateChatOptions
  onSubmit: CreateChatSubmit
}

/** One blank create-chat draft. The page keys this by a reset nonce, so reopening starts blank. */
export function CreateChatSession({
  options,
  onSubmit
}: CreateChatSessionProps): React.JSX.Element {
  const [selection, setSelection] = useState<CreateChatSelection>(() =>
    buildDefaultCreateChatSelection(options)
  )
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Why: state updates land after the render, so a second Enter in the same tick would still see canSubmit.
  const inFlight = useRef(false)
  const catalog = useCreateChatModelCatalog(selection.agent)
  const canSubmit = !pending && canSubmitCreateChat(draft, selection, options.repos)

  const submit = async (): Promise<void> => {
    if (!canSubmit || inFlight.current) {
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const outcome = await onSubmit(draft.trim(), selection)
      if (!outcome.started) {
        setError(outcome.message)
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 scrollbar-sleek">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate('components.createChat.emptyHeading', 'What do you want to build?')}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {translate(
            'components.createChat.emptySubheading',
            'Pick where it runs, the project and the agent, then write the first message to create the session.'
          )}
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <CreateChatComposer
          draft={draft}
          onDraftChange={setDraft}
          canSubmit={canSubmit}
          pending={pending}
          error={error}
          onSubmit={submit}
          leftChips={
            <CreateChatLeftChips
              selection={selection}
              options={options}
              onSelectionChange={setSelection}
            />
          }
          rightChips={
            <CreateChatAgentChip
              selection={selection}
              options={options}
              catalog={catalog}
              onSelectionChange={setSelection}
            />
          }
        />
      </div>
    </div>
  )
}
