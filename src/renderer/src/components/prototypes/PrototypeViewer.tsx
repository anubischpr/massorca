import type { RefObject } from 'react'
import { translate } from '@/i18n/i18n'
import type { NativeChatVisualAnnotateEvent } from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { latestVersionOf } from '../../../../shared/prototype-list-model'
import { cancelMerge, cancelSentMerge, canMerge } from '../../../../shared/prototype-merge-state'
import {
  pickElement,
  pinClicked,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { annotateStateOf } from '../../../../shared/prototype-set-view'
import { PrototypeDirectionStrip } from './PrototypeDirectionStrip'
import { PrototypeFrame } from './PrototypeFrame'
import { PrototypeMergeProgress } from './PrototypeMergeProgress'
import { PrototypeMergeReview } from './PrototypeMergeReview'
import { PrototypeMergeSkeleton } from './PrototypeMergeSkeleton'
import { PrototypeReadOnlyBanner } from './PrototypeReadOnlyBanner'
import { PrototypeSetGrid } from './PrototypeSetGrid'
import { PrototypeViewerToolbar } from './PrototypeViewerToolbar'
import { prototypeAgentLabel } from './prototype-labels'
import { usePrototypeViewStore } from './prototype-view-store'
import { usePrototypeFileHtml } from './use-prototype-file-html'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** "main · v3", or "main · merged from A + C" for a merged direction that is the main. */
function viewTag(state: PrototypeSetState, version: number): string {
  if (state.view !== state.active) {
    return translate('components.prototypes.curPeeking', 'read-only')
  }
  const mergedFrom = state.mergedFrom[state.view]
  return mergedFrom === undefined
    ? translate('components.prototypes.curIterating', 'main · v{{version}}', { version })
    : translate('components.prototypes.curMerged', 'main · merged from {{letters}}', {
        letters: mergedFrom.join(' + ')
      })
}

function viewHint(state: PrototypeSetState): string {
  if (state.tool === 'browse') {
    return translate('components.prototypes.hintBrowse', 'interact normally')
  }
  return state.view === state.active
    ? translate('components.prototypes.hintAnnotate', 'click any element to add a note')
    : translate('components.prototypes.hintReadOnly', 'click any element to see its properties')
}

/** The viewer of one set: the toolbar, then the set grid, the directions with the one on screen, or a merge. */
export function PrototypeViewer({
  set,
  state,
  update,
  frameBoxRef,
  onOpenDesignSystem,
  nextLetter,
  onMerge,
  onSendMerge
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
  frameBoxRef: RefObject<HTMLDivElement | null>
  /** Opens the design system of a project, from the link under the title. */
  onOpenDesignSystem: (projectKey: string) => void
  /** The letter a merged direction would take; null when the set has no free letter. */
  nextLetter: string | null
  /** Sends the suggestion request for the starred directions. */
  onMerge: () => void
  /** Sends "Merge into D." from the review. */
  onSendMerge: () => void
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
  const readOnly = state.view !== state.active
  const setSidePanelHidden = usePrototypeViewStore((s) => s.setSidePanelHidden)
  const onAnnotate = (event: NativeChatVisualAnnotateEvent): void => {
    // A pick or a pin click brings a hidden side panel back, where the draft is.
    setSidePanelHidden(false)
    update((current) =>
      event.kind === 'element-picked'
        ? pickElement(current, event.element)
        : pinClicked(current, event.pinKey)
    )
  }
  const { merge } = state

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PrototypeViewerToolbar
        set={set}
        state={state}
        update={update}
        single={single}
        mergeEnabled={set.folderPath !== undefined && canMerge(state, nextLetter)}
        onMerge={onMerge}
        onOpenDesignSystem={onOpenDesignSystem}
      />

      {merge?.phase === 'waiting' || state.mergeInto !== null ? (
        <PrototypeMergeProgress
          onCancel={() => update(merge?.phase === 'waiting' ? cancelMerge : cancelSentMerge)}
        />
      ) : null}

      {layout === 'set' && !single ? (
        <PrototypeSetGrid set={set} state={state} update={update} />
      ) : (
        <div className="flex min-h-0 flex-1 bg-chat-canvas">
          {single ? null : <PrototypeDirectionStrip set={set} state={state} update={update} />}
          {merge?.phase === 'review' && nextLetter !== null ? (
            <PrototypeMergeReview
              set={set}
              review={merge}
              agent={prototypeAgentLabel(set.agent)}
              nextLetter={nextLetter}
              sendFailed={state.mergeSendFailed}
              update={update}
              onSend={onSendMerge}
            />
          ) : merge === null ? (
            <div className="scrollbar-sleek flex min-w-0 flex-1 flex-col items-center gap-2.5 overflow-y-auto p-5">
              {state.mergeSendFailed ? (
                <span role="alert" className="text-[11px] text-destructive">
                  {translate(
                    'components.prototypes.sendFailed',
                    "Couldn't send: the chat is no longer active. Your draft is kept."
                  )}
                </span>
              ) : null}
              {readOnly ? <PrototypeReadOnlyBanner state={state} update={update} /> : null}
              <div className="text-xs text-muted-foreground">
                {[
                  viewDirection?.name !== undefined
                    ? `${state.view} · ${viewDirection.name}`
                    : state.view,
                  viewTag(state, latest?.version ?? 1),
                  viewHint(state)
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
          ) : merge?.phase === 'waiting' ? (
            <PrototypeMergeSkeleton />
          ) : (
            <div className="min-w-0 flex-1" />
          )}
        </div>
      )}
    </div>
  )
}
