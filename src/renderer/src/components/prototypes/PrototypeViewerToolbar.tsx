import { useMemo } from 'react'
import {
  LayoutGrid,
  MessageCircle,
  Monitor,
  MousePointer,
  PanelRight,
  Pencil,
  Smartphone,
  Star
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { prototypeStatus, prototypeTitle } from '../../../../shared/prototype-list-model'
import {
  setTool,
  setViewport,
  showFocus,
  showSet,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { withMergeKept } from '../../../../shared/prototype-merge-state'
import { PrototypeBuiltOnLink } from './PrototypeBuiltOnLink'
import { originChatOf } from './prototype-origin-chat'
import { prototypeAgentLabel, prototypeCountLabel } from './prototype-labels'
import { usePrototypeViewStore } from './prototype-view-store'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

const SEGMENT_CLASS = 'flex rounded-md border border-border bg-sidebar p-0.5'
const SEGMENT_BUTTON = 'flex h-6 w-7 items-center justify-center rounded transition-colors'

function segmentButtonClass(on: boolean): string {
  return cn(SEGMENT_BUTTON, on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')
}

/** Shows the name of an icon-only control on hover or focus; the control keeps the same name as its label. */
function NamedTooltip({
  name,
  children
}: {
  name: string
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} showArrow={false}>
        {name}
      </TooltipContent>
    </Tooltip>
  )
}

/** The viewer's header: the set's title and chat, Merge, the Layout, Viewport and Tool groups, the panel toggle. */
export function PrototypeViewerToolbar({
  set,
  state,
  update,
  single,
  mergeEnabled,
  onMerge,
  onOpenDesignSystem
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
  single: boolean
  /** Two stars, no merge under way, and a host that can take the request. */
  mergeEnabled: boolean
  onMerge: () => void
  onOpenDesignSystem: (projectKey: string) => void
}): React.JSX.Element {
  const layout = single ? 'focus' : state.layout
  const status = prototypeStatus(set, state.active)
  const builtOn =
    set.builtOn === undefined || set.projectKey === undefined
      ? null
      : { version: set.builtOn, projectKey: set.projectKey }
  const sidePanelHidden = usePrototypeViewStore((s) => s.sidePanelHidden)
  const setSidePanelHidden = usePrototypeViewStore((s) => s.setSidePanelHidden)
  const agentLabel = prototypeAgentLabel(set.agent)
  const chatTitle = set.chatTitle?.trim() ?? ''
  const openChat = (): void => {
    if (set.worktreeId !== null) {
      activateStructuredAgentSessionById({ worktreeId: set.worktreeId, sessionId: set.sessionId })
    }
  }
  const tabsByWorktree = useAppStore((state) => state.unifiedTabsByWorktree)
  const originSessionId = set.origin?.sessionId
  // Why: the parent's name is read from this client's tabs; a chat this client does not hold drops the link.
  const origin = useMemo(
    () => (originSessionId === undefined ? null : originChatOf(tabsByWorktree, originSessionId)),
    [originSessionId, tabsByWorktree]
  )
  const openOrigin = (): void => {
    if (origin !== null && originSessionId !== undefined) {
      activateStructuredAgentSessionById({
        worktreeId: origin.worktreeId,
        sessionId: originSessionId
      })
    }
  }
  const starCount = state.starred.length
  const mergeName =
    starCount < 2
      ? translate('components.prototypes.merge', 'Merge')
      : translate('components.prototypes.mergeCount', 'Merge ({{count}})', { count: starCount })
  const viewAllName = translate('components.prototypes.layoutAll', 'View all')
  const designMainName = translate('components.prototypes.layoutIterating', 'Design main')
  const desktopName = translate('components.prototypes.viewportDesktop', 'Desktop view')
  const phoneName = translate('components.prototypes.viewportPhone', 'Phone view')
  const browseName = translate('components.prototypes.toolBrowse', 'Browse')
  const annotateName = translate('components.prototypes.toolAnnotate', 'Annotate')
  const panelName = sidePanelHidden
    ? translate('components.prototypes.showPanel', 'Show panel')
    : translate('components.prototypes.hidePanel', 'Hide panel')
  const mergeButton = (
    <button
      type="button"
      onClick={onMerge}
      disabled={!mergeEnabled}
      aria-label={mergeName}
      className={cn(
        'flex h-7.5 items-center gap-1 rounded-lg whitespace-nowrap border border-status-amber/50 px-2 text-xs disabled:border-border disabled:text-muted-foreground',
        mergeEnabled && starCount >= 2 && 'prototype-merge-ready'
      )}
    >
      <Star aria-hidden="true" className="size-3.5 fill-status-amber text-status-amber" />
      {starCount < 2 ? null : <span>{translate('components.prototypes.merge', 'Merge')}</span>}
      {starCount === 0 ? null : <span>{starCount}</span>}
    </button>
  )
  // Why: from two stars the button shows its own name, so only the icon-only button needs a tooltip.
  const mergeControl =
    starCount < 2 ? <NamedTooltip name={mergeName}>{mergeButton}</NamedTooltip> : mergeButton
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">
          {`${prototypeTitle(set)} · ${prototypeCountLabel(status)}`}
        </span>
        {builtOn === null ? null : (
          <PrototypeBuiltOnLink
            version={builtOn.version}
            onOpen={() => onOpenDesignSystem(builtOn.projectKey)}
          />
        )}
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={openChat}
            disabled={set.worktreeId === null}
            className="truncate text-left hover:text-foreground"
          >
            {chatTitle.length > 0
              ? translate(
                  'components.prototypes.chatLink',
                  '{{agent}} · chat “{{chat}}” — open chat ↗',
                  { agent: agentLabel, chat: chatTitle }
                )
              : translate('components.prototypes.chatLinkNoTitle', '{{agent}} — open chat ↗', {
                  agent: agentLabel
                })}
          </button>
          {origin === null ? null : (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={openOrigin}
                className="truncate text-left hover:text-foreground"
              >
                {translate('components.prototypes.originLink', 'from “{{chat}}” ↗', {
                  chat: origin.title
                })}
              </button>
            </>
          )}
        </div>
      </div>
      <div role="toolbar" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        {single ? null : mergeControl}
        {single ? null : (
          <div
            role="group"
            aria-label={translate('components.prototypes.layoutGroup', 'Layout')}
            className={SEGMENT_CLASS}
          >
            <NamedTooltip name={viewAllName}>
              <button
                type="button"
                aria-label={viewAllName}
                aria-pressed={layout === 'set'}
                onClick={() => update((current) => withMergeKept(current, showSet))}
                className={segmentButtonClass(layout === 'set')}
              >
                <LayoutGrid aria-hidden="true" className="size-4" />
              </button>
            </NamedTooltip>
            <NamedTooltip name={designMainName}>
              <button
                type="button"
                aria-label={designMainName}
                aria-pressed={layout === 'focus'}
                onClick={() => update((current) => withMergeKept(current, showFocus))}
                className={segmentButtonClass(layout === 'focus')}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </button>
            </NamedTooltip>
          </div>
        )}
        <div
          role="group"
          aria-label={translate('components.prototypes.viewportGroup', 'Viewport')}
          className={SEGMENT_CLASS}
        >
          <NamedTooltip name={desktopName}>
            <button
              type="button"
              aria-label={desktopName}
              aria-pressed={state.viewport === 'desktop'}
              onClick={() => update((current) => setViewport(current, 'desktop'))}
              className={segmentButtonClass(state.viewport === 'desktop')}
            >
              <Monitor aria-hidden="true" className="size-4" />
            </button>
          </NamedTooltip>
          <NamedTooltip name={phoneName}>
            <button
              type="button"
              aria-label={phoneName}
              aria-pressed={state.viewport === 'phone'}
              onClick={() => update((current) => setViewport(current, 'phone'))}
              className={segmentButtonClass(state.viewport === 'phone')}
            >
              <Smartphone aria-hidden="true" className="size-4" />
            </button>
          </NamedTooltip>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={translate('components.prototypes.toolGroup', 'Tool')}
            className={SEGMENT_CLASS}
          >
            <NamedTooltip name={browseName}>
              <button
                type="button"
                aria-label={browseName}
                aria-pressed={state.tool === 'browse'}
                onClick={() => update((current) => setTool(current, 'browse'))}
                className={segmentButtonClass(state.tool === 'browse')}
              >
                <MousePointer aria-hidden="true" className="size-4" />
              </button>
            </NamedTooltip>
            <NamedTooltip name={annotateName}>
              <button
                type="button"
                aria-label={annotateName}
                aria-pressed={state.tool === 'annotate'}
                onClick={() => update((current) => setTool(current, 'annotate'))}
                className={segmentButtonClass(state.tool === 'annotate')}
              >
                <MessageCircle aria-hidden="true" className="size-4" />
              </button>
            </NamedTooltip>
          </div>
          <NamedTooltip name={panelName}>
            <Button
              type="button"
              variant={sidePanelHidden ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label={panelName}
              onClick={() => setSidePanelHidden(!sidePanelHidden)}
            >
              <PanelRight />
            </Button>
          </NamedTooltip>
        </div>
      </div>
    </div>
  )
}
