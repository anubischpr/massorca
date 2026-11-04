import { useCallback, useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { useAppStore } from '@/store'
import { structuredAgentSessionTargetForTab } from '@/runtime/structured-agent-session-owner'
import { isNativeChatImageAttachmentPath } from '../native-chat/native-chat-image-paste'
import type { NativeChatPendingAttachmentChips } from '../native-chat/native-chat-session-attachment-drop'
import { useNativeChatExternalAttachments } from '../native-chat/use-native-chat-external-attachments'
import { useNativeChatFileAttachmentActions } from '../native-chat/use-native-chat-file-attachment-actions'
import {
  beginDraftImage,
  removeDraftImage,
  resolveDraftImage
} from '../../../../shared/prototype-design-system-view-state'
import type { DesignSystemChat } from '../../../../shared/prototype-design-system-view'
import type { DesignSystemImageControls, DesignSystemUpdate } from './prototype-design-system-props'
import { worktreeIdOfChatSession } from './prototype-host-targets'
import { usePrototypeViewStore } from './prototype-view-store'

function basename(path: string): string {
  return path.split(/[\\/]/u).pop() ?? path
}

function imagesOnlyNotice(): string {
  return translate(
    'components.prototypes.designSystem.imagesOnly',
    'Only images can be attached here.'
  )
}

/**
 * Attaches images to the Design system draft through the chat composer's own flow: the same picker, and
 * the same upload to an SSH worktree or a paired server, so the agent can read what is attached.
 */
export function usePrototypeDesignSystemImages({
  projectKey,
  target,
  disabled,
  update
}: {
  projectKey: string
  target: DesignSystemChat | undefined
  disabled: boolean
  update: DesignSystemUpdate
}): DesignSystemImageControls {
  const [notice, setNotice] = useState<string | null>(null)
  const tabs = useAppStore((state) => state.unifiedTabsByWorktree)
  const worktreeId =
    target === undefined
      ? undefined
      : (target.worktreeId ?? worktreeIdOfChatSession(tabs, target.sessionId) ?? undefined)
  const runtimeEnvironmentId = useAppStore((state) => {
    if (target === undefined || worktreeId === undefined) {
      return null
    }
    const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (candidate) =>
        candidate.contentType === 'agent-session' && candidate.entityId === target.sessionId
    )
    const runtime = tab ? structuredAgentSessionTargetForTab(state, tab) : null
    return runtime?.kind === 'environment' ? runtime.environmentId : null
  })
  const hasImage = (id: string): boolean =>
    usePrototypeViewStore
      .getState()
      .designSystemViews[projectKey]?.images.some((image) => image.id === id) === true
  const pendingChips: NativeChatPendingAttachmentChips = {
    begin: (_previewUrl, pendingName) => {
      const id = createBrowserUuid()
      update((latest) => beginDraftImage(latest, { id, name: pendingName ?? '' }))
      return id
    },
    resolve: (id, path, connectionId) =>
      update((latest) => resolveDraftImage(latest, id, path, connectionId)),
    drop: (id) => {
      const present = hasImage(id)
      update((latest) => removeDraftImage(latest, id))
      return present
    },
    // Files that are not images reach the chat as `@path` text; the draft takes images only.
    attachReferences: (references) => {
      for (const { id } of references) {
        update((latest) => removeDraftImage(latest, id))
      }
      setNotice(imagesOnlyNotice())
    }
  }
  const attachResolvedPaths = useCallback(
    (paths: string[], connectionId?: string | null): void => {
      const images = paths.filter(isNativeChatImageAttachmentPath)
      setNotice(images.length < paths.length ? imagesOnlyNotice() : null)
      for (const path of images) {
        const id = createBrowserUuid()
        update((latest) =>
          resolveDraftImage(
            beginDraftImage(latest, { id, name: basename(path) }),
            id,
            path,
            connectionId
          )
        )
      }
    },
    [update]
  )
  const structuredSession = useMemo(
    () =>
      target === undefined ? undefined : { sessionId: target.sessionId, runtimeEnvironmentId },
    [target, runtimeEnvironmentId]
  )
  const { attachExternalPaths } = useNativeChatExternalAttachments({
    // Why '': the owner is found by the chat's worktree, never by a terminal tab.
    terminalTabId: '',
    structuredWorktreeId: worktreeId,
    structuredSession,
    disabled,
    attachResolvedPaths,
    pendingChips,
    setNotice
  })
  const { pickAttachments } = useNativeChatFileAttachmentActions(attachExternalPaths)
  return {
    pick: pickAttachments,
    disabled: disabled || target === undefined,
    notice,
    remove: (id) => update((latest) => removeDraftImage(latest, id))
  }
}
