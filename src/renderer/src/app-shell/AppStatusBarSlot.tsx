import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { translate } from '@/i18n/i18n'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import { useAppStore } from '../store'

const StatusBar = lazy(() =>
  import('../components/status-bar/StatusBar').then((module) => ({
    default: module.StatusBar
  }))
)

export function AppStatusBarSlot({
  floatingTerminalOpen
}: {
  floatingTerminalOpen: boolean
}): React.JSX.Element | null {
  const statusBarVisible = useAppStore((s) => s.statusBarVisible)
  const activeView = useAppStore((s) => s.activeView)
  if (!statusBarVisible) {
    return null
  }
  return (
    <Suspense
      fallback={
        <div className="h-6 min-h-[24px] shrink-0 border-t border-border bg-[var(--bg-titlebar,var(--card))]" />
      }
    >
      <RecoverableRenderErrorBoundary
        boundaryId="overlay.status-bar"
        surface="overlay"
        resetKey={activeView}
        title={translate('auto.App.2e8ff36f94', 'The status bar hit an error.')}
        description={translate(
          'auto.App.8a023cea1f',
          'Retry the status bar to remount its controls.'
        )}
      >
        <StatusBar floatingTerminalOpen={floatingTerminalOpen} />
      </RecoverableRenderErrorBoundary>
    </Suspense>
  )
}
