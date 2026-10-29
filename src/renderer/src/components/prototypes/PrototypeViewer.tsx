import type { RefObject } from 'react'
import { Trans } from 'react-i18next'
import { i18n, translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import type { NativeChatVisualAnnotateEvent } from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeFrame } from './PrototypeFrame'
import { PrototypeThumbnail } from './PrototypeThumbnail'
import { prototypeAgentLabel, prototypeStatusLabel } from './prototype-labels'
import {
  latestVersionOf,
  prototypeStatus,
  prototypeTitle
} from '../../../../shared/prototype-list-model'
import {
  backToActive,
  iterateHere,
  openDirection,
  peekDirection,
  pickElement,
  pinClicked,
  setTool,
  setViewport,
  showFocus,
  showSet,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { annotateStateOf } from '../../../../shared/prototype-set-view'
import { usePrototypeFileHtml } from './use-prototype-file-html'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

const SEGMENT_CLASS = 'flex rounded-md border border-border bg-sidebar p-0.5'
const SEGMENT_BUTTON = 'h-6 rounded px-2.5 text-xs transition-colors'

function segmentButtonClass(on: boolean): string {
  return cn(SEGMENT_BUTTON, on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')
}

/** The viewer of one set: the toolbar, then either the set grid or the focused direction. */
export function PrototypeViewer({
  set,
  state,
  update,
  frameBoxRef
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
  frameBoxRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const single = set.directions.length <= 1
  const layout = single ? 'focus' : state.layout
  const viewDirection = set.directions.find((direction) => direction.letter === state.view)
  const latest = latestVersionOf(viewDirection)
  const viewFile = usePrototypeFileHtml(
    latest === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: latest.fileName }
  )
  const status = prototypeStatus(set, state.active)
  const peeking = state.view !== state.active
  const agentLabel = prototypeAgentLabel(set.agent)
  const chatTitle = set.chatTitle?.trim() ?? ''
  const openChat = (): void => {
    if (set.worktreeId !== null) {
      activateStructuredAgentSessionById({ worktreeId: set.worktreeId, sessionId: set.sessionId })
    }
  }
  const onAnnotate = (event: NativeChatVisualAnnotateEvent): void => {
    update((current) =>
      event.kind === 'element-picked'
        ? pickElement(current, event.element)
        : pinClicked(current, event.pinKey)
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
        <div className="mr-auto flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">
            {`${prototypeTitle(set)} · ${prototypeStatusLabel(status)}`}
          </span>
          <button
            type="button"
            onClick={openChat}
            disabled={set.worktreeId === null}
            className="truncate text-left text-xs text-muted-foreground hover:text-foreground"
          >
            {chatTitle.length > 0
              ? translate(
                  'components.prototypes.chatLink',
                  '{{agent}} · chat “{{chat}}” — open chat ↗',
                  {
                    agent: agentLabel,
                    chat: chatTitle
                  }
                )
              : translate('components.prototypes.chatLinkNoTitle', '{{agent}} — open chat ↗', {
                  agent: agentLabel
                })}
          </button>
        </div>
        {single ? null : (
          <div
            role="group"
            aria-label={translate('components.prototypes.layoutGroup', 'Layout')}
            className={SEGMENT_CLASS}
          >
            <button
              type="button"
              aria-pressed={layout === 'set'}
              onClick={() => update(showSet)}
              className={segmentButtonClass(layout === 'set')}
            >
              {translate('components.prototypes.layoutAll', 'All {{count}}', {
                count: set.directions.length
              })}
            </button>
            <button
              type="button"
              aria-pressed={layout === 'focus'}
              onClick={() => update(showFocus)}
              className={segmentButtonClass(layout === 'focus')}
            >
              {translate('components.prototypes.layoutIterating', 'Iterating {{letter}}', {
                letter: state.active
              })}
            </button>
          </div>
        )}
        <div
          role="group"
          aria-label={translate('components.prototypes.viewportGroup', 'Viewport')}
          className={SEGMENT_CLASS}
        >
          <button
            type="button"
            aria-pressed={state.viewport === 'desktop'}
            onClick={() => update((current) => setViewport(current, 'desktop'))}
            className={segmentButtonClass(state.viewport === 'desktop')}
          >
            {translate('components.prototypes.viewportDesktop', 'Desktop')}
          </button>
          <button
            type="button"
            aria-pressed={state.viewport === 'phone'}
            onClick={() => update((current) => setViewport(current, 'phone'))}
            className={segmentButtonClass(state.viewport === 'phone')}
          >
            {translate('components.prototypes.viewportPhone', 'Phone')}
          </button>
        </div>
        <div
          role="group"
          aria-label={translate('components.prototypes.toolGroup', 'Tool')}
          className={SEGMENT_CLASS}
        >
          <button
            type="button"
            aria-pressed={state.tool === 'browse'}
            onClick={() => update((current) => setTool(current, 'browse'))}
            className={segmentButtonClass(state.tool === 'browse')}
          >
            {translate('components.prototypes.toolBrowse', 'Browse')}
          </button>
          <button
            type="button"
            aria-pressed={state.tool === 'annotate'}
            onClick={() => update((current) => setTool(current, 'annotate'))}
            className={segmentButtonClass(state.tool === 'annotate')}
          >
            {translate('components.prototypes.toolAnnotate', 'Annotate')}
          </button>
        </div>
      </div>

      {layout === 'set' && !single ? (
        <div className="scrollbar-sleek flex flex-1 flex-col gap-4 overflow-y-auto bg-background p-6">
          <div className="grid grid-cols-3 gap-5">
            {set.directions.map((direction) => (
              <div key={direction.letter} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => update((current) => openDirection(current, direction.letter))}
                  aria-label={translate(
                    'components.prototypes.cardLabel',
                    'Iterate on direction {{letter}}',
                    {
                      letter: direction.letter
                    }
                  )}
                  className={cn(
                    'rounded-lg p-2 transition-shadow',
                    direction.letter === state.active &&
                      'ring-2 ring-ring ring-offset-2 ring-offset-background'
                  )}
                >
                  <PrototypeThumbnail set={set} direction={direction} />
                </button>
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {direction.name === undefined
                      ? direction.letter
                      : translate('components.prototypes.cardName', '{{letter}} · {{name}}', {
                          letter: direction.letter,
                          name: direction.name
                        })}
                  </span>
                  {direction.tradeoff === undefined ? null : (
                    <span className="text-xs text-muted-foreground">{direction.tradeoff}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {translate(
              'components.prototypes.setFooter',
              'Open a direction to iterate on it. The others stay one click away in the side strip.'
            )}
          </span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 bg-muted/30">
          {single ? null : (
            <div
              role="group"
              aria-label={translate('components.prototypes.stripGroup', 'Directions in this set')}
              className="scrollbar-sleek flex w-28 shrink-0 flex-col gap-2.5 overflow-y-auto border-r border-border p-2.5"
            >
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {translate('components.prototypes.stripLabel', 'Set of {{count}}', {
                  count: set.directions.length
                })}
              </span>
              {set.directions.map((direction) => {
                const isActive = direction.letter === state.active
                const isViewed = direction.letter === state.view
                return (
                  <button
                    key={direction.letter}
                    type="button"
                    onClick={() => update((current) => peekDirection(current, direction.letter))}
                    aria-label={translate(
                      'components.prototypes.showDirection',
                      'Show direction {{letter}}',
                      {
                        letter: direction.letter
                      }
                    )}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-md p-1.5 text-left',
                      isViewed ? 'bg-accent' : 'hover:bg-accent/60'
                    )}
                  >
                    <PrototypeThumbnail set={set} direction={direction} />
                    <span className="flex justify-between text-xs">
                      <span className="font-semibold">{direction.letter}</span>
                      {isActive ? (
                        <span className="text-muted-foreground">
                          {translate('components.prototypes.tagIterating', 'iterating')}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="scrollbar-sleek flex min-w-0 flex-1 flex-col items-center gap-2.5 overflow-y-auto p-5">
            {peeking ? (
              <div
                role="status"
                className="flex w-full max-w-[680px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2.5"
              >
                <span className="min-w-[240px] flex-1 text-xs">
                  <Trans
                    i18n={i18n}
                    defaults={translate(
                      'components.prototypes.peekText',
                      'Peeking at <letter>{{view}}</letter> while iterating on <letter>{{active}}</letter>. Notes here go into the draft as “take this from <letter>{{view}}</letter> into <letter>{{active}}</letter>”.',
                      { view: state.view, active: state.active }
                    )}
                    components={{ letter: <span className="font-semibold" /> }}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => update(backToActive)}
                  className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-accent"
                >
                  {translate('components.prototypes.backTo', 'Back to {{active}}', {
                    active: state.active
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => update(iterateHere)}
                  className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-accent"
                >
                  {translate(
                    'components.prototypes.iterateInstead',
                    'Iterate on {{view}} instead',
                    { view: state.view }
                  )}
                </button>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              {[
                viewDirection?.name !== undefined
                  ? `${state.view} · ${viewDirection.name}`
                  : state.view,
                peeking
                  ? translate('components.prototypes.curPeeking', 'peeking')
                  : translate('components.prototypes.curIterating', 'iterating · v{{version}}', {
                      version: latest?.version ?? 1
                    }),
                state.tool === 'annotate'
                  ? translate(
                      'components.prototypes.hintAnnotate',
                      'click any element to add a note'
                    )
                  : translate('components.prototypes.hintBrowse', 'interact normally')
              ].join(' · ')}
            </div>
            <PrototypeFrame
              file={viewFile}
              fileKey={`${set.requestId}:${latest?.fileName ?? ''}`}
              viewport={state.viewport}
              annotate={annotateStateOf(state, state.view)}
              onAnnotateEvent={onAnnotate}
              boxRef={frameBoxRef}
            />
          </div>
        </div>
      )}
    </div>
  )
}
