import { useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import {
  canRestoreVersions,
  latestVersionOf,
  versionsNewestFirst
} from '../../../../shared/prototype-list-model'
import { cancelMerge, cancelSentMerge, canMerge } from '../../../../shared/prototype-merge-state'
import {
  pickElement,
  pinClicked,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { annotateStateOf } from '../../../../shared/prototype-set-view'
import { VersionRestoreDialog } from '../version-history/VersionRestoreDialog'
import { PrototypeDirectionStrip } from './PrototypeDirectionStrip'
import { PrototypeFrame } from './PrototypeFrame'
import { PrototypeMergeProgress } from './PrototypeMergeProgress'
import { PrototypeMergeReview } from './PrototypeMergeReview'
import { PrototypeMergeSkeleton } from './PrototypeMergeSkeleton'
import { PrototypeReadOnlyBanner } from './PrototypeReadOnlyBanner'
import { PrototypeSetGrid } from './PrototypeSetGrid'
import { PrototypeVersionsPanel } from './PrototypeVersionsPanel'
import { PrototypeViewerToolbar } from './PrototypeViewerToolbar'
import { prototypeAgentLabel } from './prototype-labels'
import { restorePrototypeVersionAction } from './prototype-version-restore'
import { usePrototypeViewStore } from './prototype-view-store'
import { usePrototypeFileHtml } from './use-prototype-file-html'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** What the page lets a version restore do: whether a set's host still takes one, and what follows one. */
export type PrototypeVersionRestoreControls = {
  supports: (set: PrototypeListedSet) => boolean
  /** The host answered that it predates restoring, so the page stops offering it there. */
  onOutdated: (set: PrototypeListedSet) => void
  /** A restore landed; the page lists the sets again, so the viewer shows the new current version. */
  onRestored: () => void
}

/** An earlier version on screen, read-only, with the set and direction it was opened on. */
type VersionPreview = { requestId: string; letter: string; version: number; fileName: string }

/** A preview takes no pins, edits or picks: those belong to the current version. */
const PREVIEW_ANNOTATE: NativeChatVisualAnnotateState = { enabled: false, pins: [], overrides: [] }

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

function previewTag(letter: string, version: number): string {
  return translate(
    'components.prototypes.versionPreviewTag',
    '{{letter}} · v{{version}} · earlier version, read-only',
    { letter, version }
  )
}

/** The viewer of one set: the toolbar, then the set grid, the directions with the one on screen (or an earlier version of it), or a merge. */
export function PrototypeViewer({
  set,
  state,
  update,
  frameBoxRef,
  onOpenDesignSystem,
  nextLetter,
  onMerge,
  onSendMerge,
  versions
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
  /** Restore's host answer and listing refresh, from the page. */
  versions: PrototypeVersionRestoreControls
}): React.JSX.Element {
  const single = set.directions.length <= 1
  const layout = single ? 'focus' : state.layout
  const viewDirection = set.directions.find((direction) => direction.letter === state.view)
  const latest = latestVersionOf(viewDirection)
  const [panelOpen, setPanelOpen] = useState(false)
  const [preview, setPreview] = useState<VersionPreview | null>(null)
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const viewKey = `${set.requestId}:${state.view}`
  const [previewedViewKey, setPreviewedViewKey] = useState(viewKey)
  // Why: a preview ends when its set or direction is left, so coming back shows the current version.
  if (previewedViewKey !== viewKey) {
    setPreviewedViewKey(viewKey)
    setPreview(null)
  }
  const shownPreview =
    preview !== null && preview.requestId === set.requestId && preview.letter === state.view
      ? preview
      : null
  const shown = shownPreview ?? latest
  const viewFile = usePrototypeFileHtml(
    shown === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: shown.fileName }
  )
  const readOnly = state.view !== state.active
  const canRestore = canRestoreVersions(set) && versions.supports(set)
  const setSidePanelHidden = usePrototypeViewStore((s) => s.setSidePanelHidden)
  const onAnnotate = (event: NativeChatVisualAnnotateEvent): void => {
    if (shownPreview !== null) {
      return
    }
    // A pick or a pin click brings a hidden side panel back, where the draft is.
    setSidePanelHidden(false)
    update((current) =>
      event.kind === 'element-picked'
        ? pickElement(current, event.element)
        : pinClicked(current, event.pinKey)
    )
  }
  const { merge } = state

  const restoreShown = async (version: number): Promise<void> => {
    setRestoreBusy(true)
    try {
      const outcome = await restorePrototypeVersionAction(set, state.view, version)
      if (outcome.kind === 'restored') {
        setRestoreVersion(null)
        setPreview(null)
        toast(translate('components.prototypes.versionRestored', 'Version restored'))
        versions.onRestored()
      } else if (outcome.kind === 'unsupported') {
        setRestoreVersion(null)
        versions.onOutdated(set)
        toast.error(
          translate(
            'components.prototypes.versionRestoreOutdated',
            'This host does not support restoring versions yet.'
          )
        )
      } else {
        toast.error(
          translate(
            'components.prototypes.versionRestoreFailed',
            "Couldn't restore this version. Try again."
          )
        )
      }
    } finally {
      setRestoreBusy(false)
    }
  }

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
        versions={{
          panelOpen,
          onTogglePanel: () => setPanelOpen((open) => !open),
          previewVersion: shownPreview?.version ?? null,
          canRestore,
          onBackToCurrent: () => setPreview(null),
          onRestorePreview: () => {
            if (shownPreview !== null) {
              setRestoreVersion(shownPreview.version)
            }
          }
        }}
      />

      {merge?.phase === 'waiting' || state.mergeInto !== null ? (
        <PrototypeMergeProgress
          onCancel={() => update(merge?.phase === 'waiting' ? cancelMerge : cancelSentMerge)}
        />
      ) : null}

      {layout === 'set' && !single ? (
        <PrototypeSetGrid set={set} state={state} update={update} />
      ) : (
        <div className="flex min-h-0 flex-1 bg-muted/30">
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
              {readOnly && shownPreview === null ? (
                <PrototypeReadOnlyBanner state={state} update={update} />
              ) : null}
              <div className="text-xs text-muted-foreground">
                {shownPreview === null
                  ? [
                      viewDirection?.name !== undefined
                        ? `${state.view} · ${viewDirection.name}`
                        : state.view,
                      viewTag(state, latest?.version ?? 1),
                      viewHint(state)
                    ].join(' · ')
                  : previewTag(state.view, shownPreview.version)}
              </div>
              <PrototypeFrame
                file={viewFile}
                fileKey={`${set.requestId}:${shown?.fileName ?? ''}`}
                viewport={state.viewport}
                annotate={
                  shownPreview === null ? annotateStateOf(state, state.view) : PREVIEW_ANNOTATE
                }
                onAnnotateEvent={onAnnotate}
                boxRef={frameBoxRef}
              />
            </div>
          ) : merge?.phase === 'waiting' ? (
            <PrototypeMergeSkeleton />
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {panelOpen && merge === null ? (
            <PrototypeVersionsPanel
              letter={state.view}
              versions={versionsNewestFirst(viewDirection)}
              canRestore={canRestore}
              onPreview={(version) =>
                setPreview({
                  requestId: set.requestId,
                  letter: state.view,
                  version: version.version,
                  fileName: version.fileName
                })
              }
              onRestore={(version) => setRestoreVersion(version.version)}
            />
          ) : null}
        </div>
      )}
      {restoreVersion === null ? null : (
        <VersionRestoreDialog
          busy={restoreBusy}
          title={translate(
            'components.prototypes.versionRestoreTitle',
            'Restore version {{version}} of {{letter}}?',
            { version: restoreVersion, letter: state.view }
          )}
          description={translate(
            'components.prototypes.versionRestoreHelp',
            'It becomes version {{next}}, the current one, with the content of v{{version}}. Versions 1 to {{latest}} stay in the list.',
            {
              next: (latest?.version ?? restoreVersion) + 1,
              version: restoreVersion,
              latest: latest?.version ?? restoreVersion
            }
          )}
          cancelLabel={translate('components.prototypes.versionRestoreCancel', 'Cancel')}
          restoreLabel={translate('components.prototypes.versionRestore', 'Restore')}
          onCancel={() => setRestoreVersion(null)}
          onRestore={() => void restoreShown(restoreVersion)}
        />
      )}
    </div>
  )
}
