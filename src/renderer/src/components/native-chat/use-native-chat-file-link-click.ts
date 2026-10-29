import { useCallback, type RefObject } from 'react'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import type { LinkActionRequest } from '@/components/link-actions/link-action-request'
import { buildFileLinkActions } from '@/components/terminal-pane/terminal-file-link-actions'
import {
  openDetectedFilePath,
  type FileOpenFailure
} from '@/components/terminal-pane/terminal-file-open-routing'
import {
  isTerminalLinkActionActivation,
  isTerminalLinkActivation
} from '@/components/terminal-pane/terminal-link-activation'
import { useAppStore } from '../../store'
import { routeNativeChatHref } from '../../../../shared/native-chat-href-routing'
import { resolveNativeChatFileLink, type NativeChatFileLinkContext } from './native-chat-file-link'
import { nativeChatPlainLinkClickBehavior } from './native-chat-link-click-behavior'
import { resolveNativeChatHttpLinkSourceOwner } from './native-chat-http-link-source-owner'
import {
  showFileLinkNotFoundToast,
  showFileLinkOutsideRemoteWorkspaceToast,
  showFileLinkRemoteHostOutdatedToast,
  showFileLinkUnresolvedToast,
  showFileLinkUnverifiableToast
} from './native-chat-file-link-toasts'
import {
  isOutsideRemoteWorkspaceError,
  RecordedFileHostOutdatedError
} from '@/runtime/runtime-recorded-file-client'
import { openNativeChatRecordedFile } from './native-chat-recorded-file-request'

// Why: Alt picks the tab, so Mod+Alt is the only gesture that differs from Mod+click; Shift keeps its own meaning.
function isRecordedFileTabGesture(
  event: Pick<MouseEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'>
): boolean {
  return event.altKey && !event.shiftKey && isTerminalLinkActivation(event)
}

/** A plain click offers the terminal's file popover (when that is the user's link-click
 *  setting); a modifier click opens in Orca, and Shift opens the default app. */
export function useNativeChatFileLinkClick(
  context: NativeChatFileLinkContext | null,
  request?: (request: LinkActionRequest) => void,
  rootRef?: RefObject<HTMLElement | null>
): CommentMarkdownLinkClickHandler | undefined {
  const openFileLink = useCallback<CommentMarkdownLinkClickHandler>(
    (event, href) => {
      if (!context) {
        return
      }
      const route = routeNativeChatHref(href)
      if (route.kind !== 'file') {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const state = useAppStore.getState()
      const behavior = isTerminalLinkActionActivation(event)
        ? nativeChatPlainLinkClickBehavior(state.settings)
        : 'open'
      if (behavior === 'none') {
        return
      }
      const target = resolveNativeChatFileLink(href, context)
      if (!target) {
        showFileLinkUnresolvedToast(route.pathText)
        return
      }
      const recordedInTab = isRecordedFileTabGesture(event)
      const deps = {
        worktreeId: context.worktreeId,
        worktreePath: context.worktreePath,
        runtimeEnvironmentId: context.runtimeEnvironmentId,
        ...(context.sessionId
          ? {
              agentSessionId: context.sessionId,
              // Why: a file the agent saved outside a paired host's worktree is only ever read.
              onOpenRecordedSessionFile: (path: string) => {
                const file = {
                  sessionId: context.sessionId ?? '',
                  path,
                  worktreePath: context.worktreePath,
                  runtimeEnvironmentId: context.runtimeEnvironmentId
                }
                if (recordedInTab) {
                  state.openRecordedFileTab(context.worktreeId, file)
                  return
                }
                openNativeChatRecordedFile({ ...file, worktreeId: context.worktreeId })
              }
            }
          : {}),
        // Why: an underlined link must answer every click, so a miss says why.
        onOpenFailure: (failure: FileOpenFailure) => {
          if (failure.error instanceof RecordedFileHostOutdatedError) {
            showFileLinkRemoteHostOutdatedToast()
          } else if (isOutsideRemoteWorkspaceError(failure.error)) {
            showFileLinkOutsideRemoteWorkspaceToast()
          } else if (failure.verdict === 'unverifiable') {
            showFileLinkUnverifiableToast(target.absolutePath, failure.error)
          } else {
            showFileLinkNotFoundToast(target.absolutePath)
          }
        }
      }
      if (behavior === 'open' || !request) {
        openDetectedFilePath(target.absolutePath, target.line, target.column, {
          ...deps,
          openWithSystemDefault: event.shiftKey
        })
        return
      }
      const anchor = event.currentTarget
      // A keyboard-activated link has no pointer position; anchor under the link instead.
      const keyboardAnchor = event.detail === 0 ? anchor.getBoundingClientRect() : null
      request({
        anchorX: keyboardAnchor?.left ?? event.clientX,
        anchorY: keyboardAnchor?.bottom ?? event.clientY,
        restoreFocus: () =>
          (anchor.isConnected ? anchor : rootRef?.current)?.focus({ preventScroll: true }),
        ...buildFileLinkActions(
          target.absolutePath,
          target.line,
          target.column,
          deps,
          resolveNativeChatHttpLinkSourceOwner(state, context.worktreeId)
        )
      })
    },
    [context, request, rootRef]
  )
  return context ? openFileLink : undefined
}
