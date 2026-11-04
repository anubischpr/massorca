import { useCallback, useEffect, useReducer } from 'react'
import type { MarketplaceInstallApi } from '../../../../shared/marketplace-install'
import {
  deriveGitInstallView,
  gitInstallReducer,
  initialGitInstallState,
  planForRun,
  type GitInstallView
} from './GitInstallState'

/** Null when the bridge is absent (tests, or a build without it); every caller then falls back quietly. */
function installApi(): MarketplaceInstallApi | null {
  try {
    const bridge: MarketplaceInstallApi | undefined = window.api.marketplaceInstall
    return bridge ?? null
  } catch {
    return null
  }
}

/** The Git card's state: loads status, runs Install or Manage, and re-checks when the window regains focus after a failure. */
export function useGitInstallController(): {
  view: GitInstallView
  install: () => void
  adopt: () => void
  recheck: () => void
} {
  const [state, dispatch] = useReducer(gitInstallReducer, initialGitInstallState)
  const failed = state.run.phase === 'failed'

  const recheck = useCallback(async () => {
    try {
      const api = installApi()
      if (!api) {
        dispatch({ type: 'status-failed' })
        return
      }
      dispatch({ type: 'status-loaded', status: await api.getGitStatus() })
    } catch {
      dispatch({ type: 'status-failed' })
    }
  }, [])

  useEffect(() => {
    void recheck()
  }, [recheck])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    try {
      const api = installApi()
      unsubscribe =
        api?.onGitProgress((progress) => dispatch({ type: 'progress', progress })) ?? null
    } catch {
      // Why: without the bridge the run still reports its final result.
    }
    return () => unsubscribe?.()
  }, [])

  // Why: a macOS installer window or an admin step finishes outside the app; coming back re-checks.
  useEffect(() => {
    if (!failed) {
      return
    }
    const onFocus = (): void => {
      void recheck()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [failed, recheck])

  const run = useCallback(
    async (kind: 'installGit' | 'adoptGit') => {
      try {
        const api = installApi()
        if (!api) {
          dispatch({ type: 'run-crashed' })
          return
        }
        dispatch({ type: 'run-started', plan: planForRun(state) })
        dispatch({ type: 'run-finished', result: await api[kind]() })
      } catch {
        dispatch({ type: 'run-crashed' })
      }
    },
    [state]
  )

  return {
    view: deriveGitInstallView(state),
    install: () => void run('installGit'),
    adopt: () => void run('adoptGit'),
    recheck: () => void recheck()
  }
}
