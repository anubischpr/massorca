import os from 'node:os'
import { app } from 'electron'
import {
  type CrashReportSubmitArgs,
  type CrashReportSubmitResult,
  formatCrashReportText,
  formatUncapturedCrashReportText
} from '../../shared/crash-reporting'
import { submitFeedback } from './feedback'
import type { CrashReportStore } from '../crash-reporting/crash-report-store'
import {
  getRequestedCrashReport,
  inFlightSubmissions,
  rememberSubmittedReportId,
  submittedReportIds
} from './crash-reporting-sendable-reports'

export function buildUncapturedCrashReportText(notes: string | undefined): string {
  return formatUncapturedCrashReportText(
    {
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown'
    },
    notes
  )
}

export async function submitCrashReport(
  store: CrashReportStore,
  args: CrashReportSubmitArgs
): Promise<CrashReportSubmitResult> {
  const report = await getRequestedCrashReport(store, args)
  if (!report) {
    const result = await submitFeedback({
      title: 'Crash report: no captured crash',
      feedback: buildUncapturedCrashReportText(args.notes)
    })
    return result.ok
      ? { ok: true, report: null }
      : { ok: false, status: result.status, error: result.error, report: null }
  }
  const canSubmitDismissedReport = Boolean(args.reportId && report.status === 'dismissed')
  if (
    (!canSubmitDismissedReport && report.status !== 'pending') ||
    submittedReportIds.has(report.id)
  ) {
    return {
      ok: true,
      report: submittedReportIds.has(report.id) ? { ...report, status: 'sent' } : report
    }
  }
  if (inFlightSubmissions.has(report.id)) {
    return {
      ok: false,
      status: null,
      error: 'Crash report submission already in progress.',
      report
    }
  }

  inFlightSubmissions.add(report.id)
  try {
    // Why: the issue is public, so it carries only the text the dialog previews.
    const result = await submitFeedback({
      title: `Crash report: ${report.processType} ${report.reason}`,
      feedback: formatCrashReportText(report, args.notes)
    })
    if (!result.ok) {
      return { ok: false, status: result.status, error: result.error, report }
    }
    rememberSubmittedReportId(report.id)
    if (report.status === 'dismissed') {
      try {
        // Why: startup prompts are dismissed before the user can send from
        // the still-open dialog, so successful uploads must update storage.
        const sent = await store.markDismissedSent(report.id)
        return { ok: true, report: sent ?? { ...report, status: 'sent' } }
      } catch (error) {
        console.error('[crash-reporting] Failed to mark dismissed crash report sent:', error)
        return { ok: true, report: { ...report, status: 'sent' } }
      }
    }
    try {
      const sent = await store.markSent(report.id)
      return { ok: true, report: sent ?? { ...report, status: 'sent' } }
    } catch (error) {
      // Why: the issue was already created. A local persistence
      // failure must not present as upload failure or invite duplicate sends
      // during this app session.
      console.error('[crash-reporting] Failed to mark crash report sent:', error)
      return { ok: true, report: { ...report, status: 'sent' } }
    }
  } finally {
    inFlightSubmissions.delete(report.id)
  }
}
