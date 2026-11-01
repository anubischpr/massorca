import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clipboard, Send } from 'lucide-react'
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
import {
  formatCrashReportText,
  isReactErrorBoundaryReport,
  MAX_USER_NOTES_LENGTH,
  type CrashReportRecord
} from '../../../../shared/crash-reporting'
import type { GitHubViewer } from '../../../../shared/github/pull-request-types'
import { translate } from '@/i18n/i18n'
import {
  CRASH_REPORT_SUBMIT_FAILURE_TOAST_ID,
  getCrashReportCopySubmissionFailure,
  getCrashReportSubmitFailureNotice
} from './crash-report-submit-notice'
import { useCrashReportCopy } from './use-crash-report-copy'

function formatSummary(report: CrashReportRecord): string {
  if (isReactErrorBoundaryReport(report)) {
    const surface = typeof report.details.surface === 'string' ? report.details.surface : null
    return surface ? `React render error in ${surface}` : 'React render error'
  }
  return `${report.processType} ${report.reason}${
    report.exitCode === null ? '' : ` (exit ${report.exitCode})`
  }`
}

function getDialogTitle(report: CrashReportRecord | null): string {
  if (!report) {
    return 'Report a crash'
  }
  return report && isReactErrorBoundaryReport(report)
    ? 'MassOrca hit a recoverable UI error'
    : 'MassOrca closed unexpectedly'
}

function getDialogDescription(report: CrashReportRecord | null): string {
  if (!report) {
    return 'Publish a public GitHub issue about this crash. Diagnostic logs are not included.'
  }
  return report && isReactErrorBoundaryReport(report)
    ? 'Publish a public GitHub issue with the text below. Diagnostic logs are not included.'
    : 'Publish a public GitHub issue with the text below. Diagnostic logs are not included.'
}

function getNotesPlaceholder(report: CrashReportRecord | null): string {
  if (!report) {
    return 'Optional: what happened?'
  }
  return report && isReactErrorBoundaryReport(report)
    ? 'Optional: what were you doing before this UI error?'
    : 'Optional: what were you doing before MassOrca closed?'
}

type CrashReportDialogSurfaceProps = {
  open: boolean
  report: CrashReportRecord | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  onReportChange: (report: CrashReportRecord | null) => void
}

export function CrashReportDialogSurface({
  open,
  report,
  loading,
  onOpenChange,
  onReportChange
}: CrashReportDialogSurfaceProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewer, setViewer] = useState<GitHubViewer | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  // Why: account lookup can resolve after the dialog closes or reopens.
  // Sequence the request so a stale viewer is never used for submission.
  const viewerRequestIdRef = useRef(0)
  const deferredNotes = useDeferredValue(notes)
  const diagnosticText = useMemo(
    // Why: formatting applies redaction and truncation over the full crash
    // payload. Keep that preview update out of the textarea keystroke path.
    () => (report ? formatCrashReportText(report, deferredNotes) : ''),
    [deferredNotes, report]
  )
  const copyCrashReportDetails = useCrashReportCopy(report, notes)

  const clearViewer = useCallback((): void => {
    viewerRequestIdRef.current += 1
    setViewer(null)
  }, [])

  const loadViewerForOpenDialog = useCallback((): void => {
    const requestId = ++viewerRequestIdRef.current
    setViewer(null)
    setViewerLoading(true)
    void window.api.gh
      .viewer()
      .then((nextViewer) => {
        if (mountedRef.current && requestId === viewerRequestIdRef.current) {
          setViewer(nextViewer)
        }
      })
      .catch((error) => {
        if (mountedRef.current && requestId === viewerRequestIdRef.current) {
          setViewer(null)
          console.error('Failed to load GitHub viewer for crash report:', error)
        }
      })
      .finally(() => {
        if (mountedRef.current && requestId === viewerRequestIdRef.current) {
          setViewerLoading(false)
        }
      })
  }, [mountedRef])

  useEffect(() => {
    if (!open) {
      clearViewer()
      return
    }
    loadViewerForOpenDialog()
  }, [clearViewer, loadViewerForOpenDialog, open])

  const showSubmitFailure = (error: unknown): void => {
    const failure = { error }
    const notice = getCrashReportSubmitFailureNotice(failure)
    const copyFailure = getCrashReportCopySubmissionFailure(failure)
    toast.error(notice.title, {
      id: CRASH_REPORT_SUBMIT_FAILURE_TOAST_ID,
      description: notice.description,
      duration: Infinity,
      dismissible: true,
      action: {
        label: notice.actionLabel,
        onClick: () => {
          void copyCrashReportDetails(copyFailure)
        }
      }
    })
  }

  const dismissReportIfNeeded = async (): Promise<void> => {
    if (report?.status === 'pending') {
      await window.api.crashReports.dismiss({ reportId: report.id })
      if (mountedRef.current) {
        onReportChange({ ...report, status: 'dismissed' })
      }
    }
  }

  const handleDismiss = async (): Promise<void> => {
    await dismissReportIfNeeded()
    if (mountedRef.current) {
      onOpenChange(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true)
    try {
      const result = await window.api.crashReports.submit({
        ...(report ? { reportId: report.id } : {}),
        notes
      })
      if (!result.ok) {
        showSubmitFailure(result.error)
        console.error('Failed to submit crash report:', result.error)
        return
      }
      if (!mountedRef.current) {
        return
      }
      onReportChange(result.report)
      setNotes('')
      toast.dismiss(CRASH_REPORT_SUBMIT_FAILURE_TOAST_ID)
      toast.success(
        translate(
          'auto.components.crash.report.CrashReportDialog.issueCreated',
          'GitHub issue created.'
        )
      )
      onOpenChange(false)
    } catch (error) {
      showSubmitFailure(error)
      console.error('Failed to submit crash report:', error)
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting && !nextOpen) {
          return
        }
        if (!nextOpen) {
          clearViewer()
          void dismissReportIfNeeded().finally(() => {
            if (mountedRef.current) {
              onOpenChange(false)
            }
          })
          return
        }
        onOpenChange(true)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-destructive" />
            {getDialogTitle(report)}
          </DialogTitle>
          <DialogDescription className="text-xs">{getDialogDescription(report)}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          {report ? (
            <>
              <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs">
                <div className="font-medium text-foreground">{formatSummary(report)}</div>
                <div className="mt-1 text-muted-foreground">
                  {new Date(report.createdAt).toLocaleString()} · {report.platform} {report.arch} ·
                  {translate(
                    'auto.components.crash.report.CrashReportDialog.835037edc9',
                    'MassOrca'
                  )}{' '}
                  {report.appVersion}
                </div>
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="text-[11px] font-medium text-muted-foreground">
                  {translate(
                    'auto.components.crash.report.CrashReportDialog.6d3ebe216a',
                    'Diagnostic text'
                  )}
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md border border-border bg-muted/20 p-3 font-mono text-[11px] leading-5 text-muted-foreground scrollbar-sleek">
                  {diagnosticText}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              {loading
                ? translate(
                    'auto.components.crash.report.CrashReportDialog.765591798d',
                    'Checking for crash reports...'
                  )
                : translate(
                    'auto.components.crash.report.CrashReportDialog.noCapturedReport',
                    'No automatic crash report was captured. You can still describe what happened.'
                  )}
            </div>
          )}
          <div className="space-y-1">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              // Keep the UI and formatter on the same input budget.
              maxLength={MAX_USER_NOTES_LENGTH}
              placeholder={getNotesPlaceholder(report)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div
              aria-hidden="true"
              className="text-right text-[11px] tabular-nums text-muted-foreground"
            >
              {notes.length.toLocaleString()} / {MAX_USER_NOTES_LENGTH.toLocaleString()}
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
            {viewer
              ? translate(
                  'auto.components.crash.report.CrashReportDialog.publicIssueAs',
                  'Anyone can read this issue. It will be published as {{value0}}.',
                  { value0: viewer.login }
                )
              : viewerLoading
                ? translate(
                    'auto.components.crash.report.CrashReportDialog.checkingAccount',
                    'Checking your GitHub account...'
                  )
                : translate(
                    'auto.components.crash.report.CrashReportDialog.accountRequired',
                    'Sign in with `gh auth login` to create an issue, or copy the details instead.'
                  )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyCrashReportDetails()}
            disabled={loading}
          >
            <Clipboard className="size-3.5" />
            {translate('auto.components.crash.report.CrashReportDialog.50b00dc327', 'Copy Details')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={submitting}
          >
            {translate('auto.components.crash.report.CrashReportDialog.88fea8e84e', "Don't Send")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={loading || submitting || !viewer}
          >
            <Send className="size-3.5" />
            {translate(
              'auto.components.crash.report.CrashReportDialog.createIssue',
              'Create GitHub Issue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
