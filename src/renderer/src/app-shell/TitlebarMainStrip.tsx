import { PanelRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { ActivityTitlebarControls } from '../components/activity/ActivityTitlebarControls'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store'
import { hasCustomTitleBar } from './app-window-chrome'
import { BarToggle } from './BarToggle'
import { setPageTopBandActionsTarget, setPageTopBandTitleTarget } from './page-top-band-slot'
import type { AppChromeLayout } from './use-app-chrome-layout'

export function RightSidebarToggle(): React.JSX.Element {
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)
  const rightSidebarShortcutLabel = useShortcutLabel('sidebar.right.toggle')
  return (
    <BarToggle
      label={translate('auto.App.9e0b441a91', 'Toggle right sidebar')}
      tooltip={translate('auto.App.c184e056de', 'Toggle right sidebar ({{value0}})', {
        value0: rightSidebarShortcutLabel
      })}
      pressed={rightSidebarOpen}
      onClick={toggleRightSidebar}
    >
      <PanelRight />
    </BarToggle>
  )
}

/** The titlebar's center/right strip: the trailing chrome buttons. */
export function TitlebarMainStrip({
  layout
}: {
  layout: Pick<
    AppChromeLayout,
    'activeView' | 'showRightSidebarControls' | 'rightSidebarOpen' | 'workspaceChromeActive'
  >
}): React.JSX.Element {
  return (
    <>
      {layout.activeView === 'activity' ? (
        <ActivityTitlebarControls />
      ) : (
        // Why: this keeps the strip's buttons right-aligned; a page's title renders into it, and what
        // is left stays draggable.
        <div
          ref={setPageTopBandTitleTarget}
          data-page-top-band-title="true"
          className="flex flex-1 min-w-0 self-stretch items-center"
        />
      )}
      {/* Why: a page with a panel of its own (Prototypes) renders that panel's toggle here, where sessions keep theirs. */}
      <div
        ref={setPageTopBandActionsTarget}
        data-page-top-band-actions="true"
        className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
      />
      {/* Why: one toggle, always left of the sidebar line; a workspace session bar has its own. */}
      {layout.showRightSidebarControls && !layout.workspaceChromeActive ? (
        <div className="mr-4 flex shrink-0 items-center [-webkit-app-region:no-drag]">
          <RightSidebarToggle />
        </div>
      ) : null}
      {/* Why: reserve space so the Windows/Linux window-controls overlay doesn't obscure content. */}
      {/* Why: an open right sidebar already covers the corner under the overlay. */}
      {hasCustomTitleBar && !(layout.showRightSidebarControls && layout.rightSidebarOpen) ? (
        <div className="window-controls-titlebar-spacer" />
      ) : null}
    </>
  )
}
