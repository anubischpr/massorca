import { PanelRight, Star } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { prototypeStatus, prototypeTitle } from '../../../../shared/prototype-list-model'
import {
  setTool,
  setViewport,
  showFocus,
  showSet,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import { PrototypeBuiltOnLink } from './PrototypeBuiltOnLink'
import { prototypeAgentLabel, prototypeCountLabel } from './prototype-labels'
import { usePrototypeViewStore } from './prototype-view-store'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

const SEGMENT_CLASS = 'flex rounded-md border border-border bg-sidebar p-0.5'
const SEGMENT_BUTTON = 'h-6 rounded px-2.5 text-xs whitespace-nowrap transition-colors'

function segmentButtonClass(on: boolean): string {
  return cn(SEGMENT_BUTTON, on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')
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
  const starCount = state.starred.length
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
      <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">
          {`${prototypeTitle(set)} · ${prototypeCountLabel(status)}`}
        </span>
        {builtOn === null ? null : (
          <PrototypeBuiltOnLink
            version={builtOn.version}
            onOpen={() => onOpenDesignSystem(builtOn.projectKey)}
          />
        )}
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
                { agent: agentLabel, chat: chatTitle }
              )
            : translate('components.prototypes.chatLinkNoTitle', '{{agent}} — open chat ↗', {
                agent: agentLabel
              })}
        </button>
      </div>
      <div
        role="toolbar"
        className="scrollbar-sleek flex max-w-full shrink-0 items-center gap-2 overflow-x-auto [&>*]:shrink-0"
      >
        {single ? null : (
          <button
            type="button"
            onClick={onMerge}
            disabled={!mergeEnabled}
            className="flex h-7 items-center gap-1.5 rounded-lg whitespace-nowrap border border-status-amber/50 px-3 text-xs disabled:border-border disabled:text-muted-foreground"
          >
            <Star aria-hidden="true" className="size-3.5 fill-status-amber text-status-amber" />
            {starCount === 0
              ? translate('components.prototypes.merge', 'Merge')
              : translate('components.prototypes.mergeCount', 'Merge ({{count}})', {
                  count: starCount
                })}
          </button>
        )}
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
              {translate('components.prototypes.layoutAll', 'View all')}
            </button>
            <button
              type="button"
              aria-pressed={layout === 'focus'}
              onClick={() => update(showFocus)}
              className={segmentButtonClass(layout === 'focus')}
            >
              {translate('components.prototypes.layoutIterating', 'Design main')}
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
        <Button
          type="button"
          variant={sidePanelHidden ? 'secondary' : 'ghost'}
          size="icon-xs"
          aria-label={
            sidePanelHidden
              ? translate('components.prototypes.showPanel', 'Show panel')
              : translate('components.prototypes.hidePanel', 'Hide panel')
          }
          onClick={() => setSidePanelHidden(!sidePanelHidden)}
        >
          <PanelRight />
        </Button>
      </div>
    </div>
  )
}
