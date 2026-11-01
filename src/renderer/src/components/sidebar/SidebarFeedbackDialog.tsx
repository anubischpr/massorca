/* oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Why: feedback viewer details are loaded through GitHub IPC after the dialog receives the issue URL. */
import React, { useRef, useState } from 'react'
import { Clipboard, ExternalLink, Github } from 'lucide-react'
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
import { useMountedRef } from '@/hooks/useMountedRef'
import { useAppStore } from '@/store'
import type { GitHubViewer } from '../../../../shared/github/pull-request-types'
import { translate } from '@/i18n/i18n'
import { stripClientEnvironmentFooter } from '../../../../shared/client-environment-info'
import { useSidebarFeedbackEnvironmentPrefill } from './use-sidebar-feedback-environment-prefill'
import { MASSORCA_ISSUES_URL } from '../../../../shared/massorca-distribution'

const GITHUB_ISSUES_URL = `${MASSORCA_ISSUES_URL}/`
const DISCORD_URL = 'https://discord.gg/fzjDKHxv8Q'
const X_URL = 'https://x.com/orca_build'

type SidebarFeedbackDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function openExternalUrl(url: string): void {
  void window.api.shell.openUrl(url)
}

export function SidebarFeedbackDialog({
  open,
  onOpenChange
}: SidebarFeedbackDialogProps): React.JSX.Element {
  // Why: the draft lives in the app store, not component state. This dialog
  // renders inside the sidebar subtree, so collapsing the sidebar unmounts it
  // and would otherwise discard a report the user has not managed to send yet
  // (orca#22466).
  const feedback = useAppStore((s) => s.feedbackDraft.feedback)
  const setFeedbackDraft = useAppStore((s) => s.setFeedbackDraft)
  const clearFeedbackDraft = useAppStore((s) => s.clearFeedbackDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewer, setViewer] = useState<GitHubViewer | null>(null)
  const [isViewerLoading, setIsViewerLoading] = useState(false)
  const mountedRef = useMountedRef()
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null)
  // Why: reads the committed draft at call time so a late-resolving prefill
  // cannot overwrite characters typed while it was in flight.
  const setFeedback = React.useCallback(
    (updater: (current: string) => string) => {
      setFeedbackDraft({ feedback: updater(useAppStore.getState().feedbackDraft.feedback) })
    },
    [setFeedbackDraft]
  )

  useSidebarFeedbackEnvironmentPrefill({
    open,
    feedback,
    setFeedback,
    textareaRef: feedbackTextareaRef,
    mountedRef
  })

  React.useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setIsViewerLoading(true)
    void window.api.gh
      .viewer()
      .then((nextViewer) => {
        if (!cancelled) {
          setViewer(nextViewer)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setViewer(null)
          console.error('Failed to load GitHub viewer:', err)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsViewerLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting || !viewer) {
      return
    }
    const trimmed = feedback.trim()
    const userText = stripClientEnvironmentFooter(feedback).trim()
    if (!trimmed || !userText) {
      toast.warning(
        translate(
          'auto.components.sidebar.SidebarFeedbackDialog.a2fd890d9e',
          'Please enter feedback before submitting.'
        )
      )
      return
    }

    setIsSubmitting(true)
    try {
      const result = await window.api.feedback.submit({ feedback: trimmed })

      if (!result.ok) {
        throw new Error(`Feedback request failed: ${result.error}`)
      }

      // Why: the issue exists, so the draft has to go even if the sidebar
      // collapsed mid-flight — otherwise it reappears on remount and invites a
      // duplicate send. Store actions outlive the component but `mountedRef`
      // does not, so this runs unguarded and instead compares what the user
      // wrote: a different report typed after a remount must survive this
      // stale handler. The env footer is stripped from both sides because the
      // remount's prefill re-appends it on its own.
      if (
        stripClientEnvironmentFooter(useAppStore.getState().feedbackDraft.feedback).trim() ===
        userText
      ) {
        clearFeedbackDraft()
      }

      if (mountedRef.current) {
        const issueUrl = result.url
        toast.success(
          translate(
            'auto.components.sidebar.SidebarFeedbackDialog.issueCreated',
            'GitHub issue created.'
          ),
          {
            action: {
              label: translate(
                'auto.components.sidebar.SidebarFeedbackDialog.viewIssue',
                'View issue'
              ),
              onClick: () => openExternalUrl(issueUrl)
            }
          }
        )
        onOpenChange(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        toast.error(
          translate(
            'auto.components.sidebar.SidebarFeedbackDialog.issueNotCreated',
            "GitHub issue wasn't created. Your text is still here; try again or copy it."
          )
        )
      }
      console.error('Failed to submit feedback:', err)
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(feedback)
      toast.success(
        translate('auto.components.sidebar.SidebarFeedbackDialog.copied', 'Feedback copied.')
      )
    } catch (err) {
      toast.error(
        translate(
          'auto.components.sidebar.SidebarFeedbackDialog.copyFailed',
          "Couldn't copy your feedback."
        )
      )
      console.error('Failed to copy feedback:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-3rem)] overflow-y-auto scrollbar-sleek sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          feedbackTextareaRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">
            {translate('auto.components.sidebar.SidebarFeedbackDialog.0eb643f07f', 'Send Feedback')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {translate(
              'auto.components.sidebar.SidebarFeedbackDialog.publicIssueDescription',
              "Share what's working, what's broken, or what MassOrca should do next. This publishes a public GitHub issue."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
          <div className="text-xs font-medium text-foreground">
            {translate(
              'auto.components.sidebar.SidebarFeedbackDialog.9b33530b3d',
              'Other ways to reach us'
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => openExternalUrl(GITHUB_ISSUES_URL)}
            >
              <Github className="size-3.5" />
              {translate(
                'auto.components.sidebar.SidebarFeedbackDialog.d245c4ef6c',
                'GitHub issues'
              )}
              <ExternalLink className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => openExternalUrl(DISCORD_URL)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
                <path d="M20.317 4.369A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.77-.553 1.116a18.27 18.27 0 0 0-5.098 0A12.64 12.64 0 0 0 9.68 3a19.736 19.736 0 0 0-4.433 1.369C2.444 8.479 1.69 12.488 2.067 16.44a19.912 19.912 0 0 0 5.427 2.744c.438-.598.828-1.23 1.164-1.89a12.95 12.95 0 0 1-1.833-.877c.154-.113.305-.231.45-.352a14.294 14.294 0 0 0 12.45 0c.146.12.296.239.45.352-.585.34-1.2.634-1.835.878.337.659.727 1.29 1.165 1.888a19.84 19.84 0 0 0 5.43-2.744c.442-4.579-.755-8.551-3.932-12.07ZM9.955 14.005c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.095 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm4.09 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
              </svg>
              {translate(
                'auto.components.sidebar.SidebarFeedbackDialog.26108d3699',
                'Join Discord'
              )}
              <ExternalLink className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => openExternalUrl(X_URL)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
                <path d="M18.901 1.153h3.68l-8.041 9.19L24 22.847h-7.406l-5.8-7.584-6.64 7.584H.474l8.6-9.83L0 1.153h7.594l5.243 6.932 6.064-6.932Zm-1.29 19.493h2.04L6.486 3.24H4.298l13.313 17.406Z" />
              </svg>
              {translate('auto.components.sidebar.SidebarFeedbackDialog.3460258a54', 'Follow on X')}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        <textarea
          ref={feedbackTextareaRef}
          value={feedback}
          onChange={(event) => setFeedbackDraft({ feedback: event.target.value })}
          placeholder={translate(
            'auto.components.sidebar.SidebarFeedbackDialog.d46ddd66fc',
            'What could we improve?'
          )}
          rows={7}
          className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        <div className="min-h-9 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
          {viewer ? (
            <div className="text-xs text-muted-foreground">
              {translate(
                'auto.components.sidebar.SidebarFeedbackDialog.publicIssueAs',
                'Anyone can read this issue. It will be published as {{value0}}.',
                { value0: viewer.login }
              )}
            </div>
          ) : isViewerLoading ? (
            <div className="text-xs text-muted-foreground">
              {translate(
                'auto.components.sidebar.SidebarFeedbackDialog.d20439c560',
                'Checking GitHub identity…'
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {translate(
                'auto.components.sidebar.SidebarFeedbackDialog.accountRequired',
                'Sign in with `gh auth login` to create an issue, or copy your feedback instead.'
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {translate('auto.components.sidebar.SidebarFeedbackDialog.8bf619e4cf', 'Cancel')}
          </Button>
          <Button variant="outline" onClick={() => void handleCopy()}>
            <Clipboard className="size-3.5" />
            {translate('auto.components.sidebar.SidebarFeedbackDialog.copy', 'Copy')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting || !viewer || stripClientEnvironmentFooter(feedback).trim() === ''
            }
          >
            {isSubmitting
              ? translate(
                  'auto.components.sidebar.SidebarFeedbackDialog.creatingIssue',
                  'Creating…'
                )
              : translate(
                  'auto.components.sidebar.SidebarFeedbackDialog.createIssue',
                  'Create GitHub Issue'
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
