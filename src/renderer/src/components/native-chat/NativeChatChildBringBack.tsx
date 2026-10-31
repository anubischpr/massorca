import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import { useAppStore } from '@/store'
import { childBringBackView, type ChildBringBackLine } from '../../../../shared/child-bring-back'
import { useChildBringBack, type ChildBringBackCall } from '../../../../shared/use-child-bring-back'
import { ConflictSummaryCard } from '../right-sidebar/source-control/listing/conflict-status-cards'
import { openNativeChatSourceControl } from './native-chat-session-navigation'

function lineText(line: ChildBringBackLine): string {
  return translate(
    `components.native-chat.childBringBack.${line.id}`,
    line.template,
    line.params ?? {}
  )
}

/** Bring back's part of a finished child notice: its facts, its warnings and its actions. */
export function NativeChatChildBringBack({
  requestId,
  openChild
}: {
  requestId: string
  /** Open child chat, or null when the child has no chat to open. */
  openChild: (() => void) | null
}): React.JSX.Element | null {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const target = useWorktreeRuntimeTarget(worktreeId)
  const call = useMemo<ChildBringBackCall>(
    // Why: no target means direct SSH, whose git this process's runtime drives over the relay.
    () => (method, params) =>
      callRuntimeRpc(target ?? { kind: 'local' }, method, params, {
        timeoutMs: 120_000
      }),
    [target]
  )
  const { status, busy, error, bringBack, abort, resolve } = useChildBringBack(requestId, call)
  const view = childBringBackView(status)
  const open = view.childOpenable ? openChild : null
  return (
    <>
      {view.meta.length > 0 ? (
        <p className="text-xs text-muted-foreground">{view.meta.map(lineText).join(' · ')}</p>
      ) : null}
      {view.warnings.map((line) => (
        <p key={line.id} className="text-xs text-status-warning">
          {lineText(line)}
        </p>
      ))}
      {view.conflicts ? (
        <ConflictSummaryCard
          conflictOperation="merge"
          unresolvedCount={view.conflicts.unresolved}
          sourceControlAiActionsVisible
          isResolvingWithAI={busy}
          isAbortingOperation={busy}
          onAbortOperation={abort}
          onResolveWithAI={resolve}
          onReview={() => void openNativeChatSourceControl()}
        />
      ) : null}
      {error ? <p className="break-words text-xs text-destructive">{error}</p> : null}
      {view.action || open ? (
        <div className="flex flex-wrap gap-2">
          {view.action ? (
            <Button size="sm" disabled={busy || !view.action.enabled} onClick={bringBack}>
              {busy
                ? translate('components.native-chat.childBringBack.running', 'Bringing back…')
                : translate('components.native-chat.childBringBack.action', 'Bring back')}
            </Button>
          ) : null}
          {open ? (
            <Button variant="outline" size="sm" onClick={open}>
              {translate('components.native-chat.delegation.openChild', 'Open child chat')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
