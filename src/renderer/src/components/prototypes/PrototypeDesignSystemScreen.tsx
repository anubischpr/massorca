import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import {
  designSystemChatOf,
  setsBuiltOn,
  type DesignSystemChat
} from '../../../../shared/prototype-design-system-view'
import {
  emptyDesignSystemViewState,
  sendAccepted,
  sendBegun,
  sendRefused,
  sendableDraftImages,
  type DesignSystemSendKind,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import { designSystemContentOf } from '../../../../shared/prototype-design-system-content'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { VersionRestoreDialog } from '../version-history/VersionRestoreDialog'
import { PrototypeDesignSystemAside } from './PrototypeDesignSystemAside'
import { PrototypeDesignSystemVersionsPanel } from './PrototypeDesignSystemVersionsPanel'
import {
  PrototypeDesignSystemView,
  type DesignSystemVersionsControls
} from './PrototypeDesignSystemView'
import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { restoreDesignSystemVersionAction } from './prototype-design-system-restore'
import {
  NO_DESIGN_SYSTEM_VERSION_VIEW,
  backToCurrentVersion,
  openDraftPanel,
  openVersionsPanel,
  previewDesignSystemVersion
} from './prototype-design-system-version-view'
import { usePrototypeViewStore } from './prototype-view-store'
import { useDesignSystemContent } from './use-prototype-design-system-content'
import { usePrototypeDesignSystemImages } from './use-prototype-design-system-images'
import {
  useDesignSystemVersionContent,
  useDesignSystemVersions
} from './use-prototype-design-system-versions'

// One shared empty state, so a project with no state yet hands the same object to every render.
const NO_VIEW_STATE = emptyDesignSystemViewState()
// Why: an earlier version that is still loading shows nothing under its banner, never the current files.
const EMPTY_CONTENT = designSystemContentOf({})

/**
 * The Design system screen of the selected project. Its view state is kept per project, so a tab, a
 * selection or a draft survives moving to a set and back.
 */
export function PrototypeDesignSystemScreen({
  system,
  sets,
  sendText,
  onRestored
}: {
  system: PrototypeListedDesignSystem
  sets: readonly PrototypeListedSet[]
  /** Sends text, with the draft's images, to a chat; true only when the chat took it. */
  sendText: (
    chat: DesignSystemChat,
    text: string,
    images: readonly { path: string; connectionId?: string }[]
  ) => Promise<boolean>
  /** A restore landed: the page lists the systems again, so the screen shows the new current version. */
  onRestored: () => void
}): React.JSX.Element {
  const { projectKey } = system
  const target = designSystemChatOf(sets, system)
  const rebuildSets = setsBuiltOn(sets, projectKey, system.version)
  const content = useDesignSystemContent(
    target?.sessionId,
    `${projectKey}:${system.version}:${system.tokenCount}:${system.status}`
  )
  const state = usePrototypeViewStore(
    (store) => store.designSystemViews[projectKey] ?? NO_VIEW_STATE
  )
  const updateView = usePrototypeViewStore((store) => store.updateDesignSystemView)
  const update = useCallback(
    (transform: (latest: DesignSystemViewState) => DesignSystemViewState): void => {
      updateView(projectKey, transform)
    },
    [updateView, projectKey]
  )
  const versionView = usePrototypeViewStore(
    (store) => store.designSystemVersionViews[projectKey] ?? NO_DESIGN_SYSTEM_VERSION_VIEW
  )
  const updateVersionView = usePrototypeViewStore((store) => store.updateDesignSystemVersionView)
  const updateVersions = useCallback(
    (transform: Parameters<typeof updateVersionView>[1]): void => {
      updateVersionView(projectKey, transform)
    },
    [updateVersionView, projectKey]
  )
  const versions = useDesignSystemVersions(
    target?.sessionId,
    `${projectKey}:${system.version}:${system.status}`
  )
  const listedVersions = versions.status === 'ready' ? versions.versions : null
  const showVersions = listedVersions !== null && versionView.panel === 'versions'
  const preview = showVersions ? versionView.preview : null
  const previewContent = useDesignSystemVersionContent(target?.sessionId, preview)
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  useEffect(() => {
    if (previewContent?.status === 'error') {
      updateVersions(backToCurrentVersion)
      toast.error(
        translate(
          'components.prototypes.designSystem.versionOpenFailed',
          "Couldn't open this version."
        )
      )
    }
  }, [previewContent, updateVersions])
  const images = usePrototypeDesignSystemImages({
    projectKey,
    target,
    disabled: state.sending,
    update
  })
  const runSend = async (
    kind: DesignSystemSendKind,
    text: string,
    chat: DesignSystemChat | undefined = target
  ): Promise<void> => {
    const current = usePrototypeViewStore.getState().designSystemViews[projectKey]
    if (chat === undefined || current?.sending === true) {
      return
    }
    update(sendBegun)
    // Only the draft carries the images; a re-detect or a palette approval sends its text alone.
    const images = kind === 'draft' ? sendableDraftImages(current ?? NO_VIEW_STATE) : []
    const accepted = await sendText(chat, text, images).catch(() => false)
    update((latest) => (accepted ? sendAccepted(latest, kind) : sendRefused(latest, kind)))
  }
  const restore = async (version: number): Promise<void> => {
    if (target === undefined) {
      return
    }
    setRestoreBusy(true)
    try {
      const outcome = await restoreDesignSystemVersionAction(target.sessionId, version)
      if (outcome.kind === 'restored') {
        setRestoreVersion(null)
        updateVersions(backToCurrentVersion)
        toast(translate('components.prototypes.designSystem.versionRestored', 'Version restored'))
        onRestored()
      } else {
        toast.error(
          translate(
            'components.prototypes.designSystem.versionRestoreFailed',
            "Couldn't restore this version. Try again."
          )
        )
      }
    } finally {
      setRestoreBusy(false)
    }
  }
  if (content.status === 'loading') {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-sidebar" />
    )
  }
  if (content.status === 'error') {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-sidebar">
        <p className="p-6 text-sm text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.unreadable',
            "Couldn't open this design system"
          )}
        </p>
      </section>
    )
  }
  const shownContent =
    preview === null
      ? content.content
      : previewContent?.status === 'ready'
        ? previewContent.content
        : EMPTY_CONTENT
  const panel: DesignSystemPanelProps = {
    system,
    content: shownContent,
    state,
    update,
    target,
    rebuildSets,
    runSend,
    images
  }
  const versionsControls: DesignSystemVersionsControls | undefined =
    listedVersions === null
      ? undefined
      : {
          panelOpen: showVersions,
          onToggle: () => updateVersions(showVersions ? openDraftPanel : openVersionsPanel),
          preview,
          nextVersion: system.version + 1,
          onBackToCurrent: () => updateVersions(backToCurrentVersion),
          onRestorePreview: () => {
            if (preview !== null) {
              setRestoreVersion(preview)
            }
          }
        }
  return (
    <>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-sidebar">
        <PrototypeDesignSystemView {...panel} versions={versionsControls} />
      </section>
      <aside className="scrollbar-sleek flex min-h-0 w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
        {listedVersions !== null && showVersions ? (
          <PrototypeDesignSystemVersionsPanel
            versions={listedVersions}
            onPreview={(version) =>
              updateVersions((view) => previewDesignSystemVersion(view, version))
            }
            onRestore={setRestoreVersion}
          />
        ) : (
          <PrototypeDesignSystemAside {...panel} />
        )}
      </aside>
      {restoreVersion === null ? null : (
        <VersionRestoreDialog
          busy={restoreBusy}
          title={translate(
            'components.prototypes.designSystem.versionRestoreTitle',
            'Restore version {{version}}?',
            { version: restoreVersion }
          )}
          description={translate(
            'components.prototypes.designSystem.versionRestoreHelp',
            'It becomes version {{next}}, the current one, with the content of v{{version}}. Versions 1 to {{latest}} stay in the list.',
            { next: system.version + 1, version: restoreVersion, latest: system.version }
          )}
          cancelLabel={translate(
            'components.prototypes.designSystem.versionRestoreCancel',
            'Cancel'
          )}
          restoreLabel={translate('components.prototypes.designSystem.versionRestore', 'Restore')}
          onCancel={() => setRestoreVersion(null)}
          onRestore={() => void restore(restoreVersion)}
        />
      )}
    </>
  )
}
