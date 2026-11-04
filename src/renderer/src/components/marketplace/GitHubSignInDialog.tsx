import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { translate } from '@/i18n/i18n'
import type {
  GhSignInEvent,
  GhSignInFailureReason
} from '../../../../preload/api/github-account-api'
import { copyMarketplaceText } from './marketplace-clipboard'

type SignInView =
  | { kind: 'starting' }
  | { kind: 'code'; userCode: string; verificationUrl: string }
  | { kind: 'failed'; reason: GhSignInFailureReason }

type GitHubSignInDialogProps = {
  open: boolean
  host: string
  onOpenChange: (open: boolean) => void
  onSignedIn: () => void
}

/** Signs in with `gh auth login` on this computer: shows the one-time code, then waits while GitHub confirms. */
export function GitHubSignInDialog({
  open,
  host,
  onOpenChange,
  onSignedIn
}: GitHubSignInDialogProps): React.JSX.Element {
  const [view, setView] = useState<SignInView>({ kind: 'starting' })
  const [attempt, setAttempt] = useState(0)
  // Why: the sign-in must not restart when the parent passes new callback identities.
  const callbacksRef = useRef({ onOpenChange, onSignedIn })
  callbacksRef.current = { onOpenChange, onSignedIn }

  useEffect(() => {
    if (!open) {
      return
    }
    const signInId = createBrowserUuid()
    let current = true
    setView({ kind: 'starting' })
    const unsubscribe = window.api.gh.onSignInEvent((event: GhSignInEvent) => {
      if (!current || event.signInId !== signInId) {
        return
      }
      const { state } = event
      if (state.kind === 'code') {
        setView({
          kind: 'code',
          userCode: state.userCode,
          verificationUrl: state.verificationUrl
        })
      } else if (state.kind === 'done') {
        callbacksRef.current.onSignedIn()
        callbacksRef.current.onOpenChange(false)
      } else {
        setView({ kind: 'failed', reason: state.reason })
      }
    })
    void window.api.gh
      .startSignIn({ signInId, host })
      .then((result) => {
        if (current && !result.ok) {
          setView({ kind: 'failed', reason: 'unavailable' })
        }
      })
      .catch(() => {
        if (current) {
          setView({ kind: 'failed', reason: 'unavailable' })
        }
      })
    return () => {
      current = false
      unsubscribe()
      // Why: closing the dialog, Cancel, or a finished sign-in all end the flow here; cancel is a no-op once it settled.
      void window.api.gh.cancelSignIn({ signInId }).catch(() => undefined)
    }
  }, [open, host, attempt])

  const openGitHub = (url: string): void => {
    window.api.shell.openUrl(url).catch(() => {
      toast.error(
        translate(
          'auto.components.marketplace.GitHubSignInDialog.openFailed',
          'Could not open GitHub'
        )
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.marketplace.GitHubSignInDialog.title', 'GitHub: sign in')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.marketplace.GitHubSignInDialog.description',
              'Signs in with the GitHub CLI on {{host}}.',
              { host }
            )}
          </DialogDescription>
        </DialogHeader>

        {view.kind === 'starting' ? (
          <p className="text-sm text-muted-foreground">
            {translate(
              'auto.components.marketplace.GitHubSignInDialog.starting',
              'Starting GitHub sign-in…'
            )}
          </p>
        ) : null}

        {view.kind === 'code' ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <span className="text-sm font-medium">
                  {translate(
                    'auto.components.marketplace.GitHubSignInDialog.copyStep',
                    '1. Copy this one-time code'
                  )}
                </span>
                <span className="font-mono text-xl font-semibold tracking-wider select-all">
                  {view.userCode}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => void copyMarketplaceText(view.userCode)}
                >
                  {translate('auto.components.marketplace.GitHubSignInDialog.copy', 'Copy')}
                </Button>
              </div>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <span className="text-sm font-medium">
                  {translate(
                    'auto.components.marketplace.GitHubSignInDialog.openStep',
                    '2. Paste it on GitHub and allow access'
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="self-start"
                  onClick={() => openGitHub(view.verificationUrl)}
                >
                  {translate(
                    'auto.components.marketplace.GitHubSignInDialog.openGitHub',
                    'Open GitHub'
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {translate(
                'auto.components.marketplace.GitHubSignInDialog.waiting',
                'Waiting for GitHub. This page updates by itself.'
              )}
            </p>
          </div>
        ) : null}

        {view.kind === 'failed' ? (
          <p className="text-sm text-destructive">{failureMessage(view.reason)}</p>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => void copyMarketplaceText(`gh auth login --hostname ${host}`)}
          >
            {translate(
              'auto.components.marketplace.GitHubSignInDialog.terminal',
              'Use a terminal instead'
            )}
          </Button>
          <div className="flex gap-2">
            {view.kind === 'failed' ? (
              <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                {translate('auto.components.marketplace.GitHubSignInDialog.retry', 'Try again')}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {translate('auto.components.marketplace.GitHubSignInDialog.cancel', 'Cancel')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function failureMessage(reason: GhSignInFailureReason): string {
  switch (reason) {
    case 'timeout':
      return translate(
        'auto.components.marketplace.GitHubSignInDialog.timeout',
        'The code expired before it was used. Try again to get a new one.'
      )
    case 'unavailable':
      return translate(
        'auto.components.marketplace.GitHubSignInDialog.unavailable',
        'The GitHub CLI could not start. Install it, then try again.'
      )
    case 'cancelled':
    case 'failed':
      return translate(
        'auto.components.marketplace.GitHubSignInDialog.failed',
        'GitHub sign-in did not finish. Try again, or use a terminal instead.'
      )
  }
}
