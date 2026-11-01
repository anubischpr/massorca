import { translate } from '@/i18n/i18n'
import {
  sanitizeCrashReportString,
  type CrashReportCopySubmissionFailure
} from '../../../../shared/crash-reporting'

export const CRASH_REPORT_SUBMIT_FAILURE_TOAST_ID = 'crash-report-submit-failure'

export type CrashReportSubmitFailureNotice = {
  title: string
  description: string
  actionLabel: string
}

type CrashReportSubmitFailureLike = {
  error: unknown
}

function normalizedFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const sanitized = sanitizeCrashReportString(message).trim()
  return (
    sanitized ||
    translate(
      'auto.components.crash.report.submit.notice.unknownError',
      'The crash report request failed before it returned a reason.'
    )
  )
}

function asSentence(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`
}

export function getCrashReportCopySubmissionFailure(
  failure: CrashReportSubmitFailureLike
): CrashReportCopySubmissionFailure {
  return { error: normalizedFailureMessage(failure.error) }
}

export function getCrashReportSubmitFailureNotice(
  failure: CrashReportSubmitFailureLike
): CrashReportSubmitFailureNotice {
  return {
    title: translate(
      'auto.components.crash.report.submit.notice.issueNotCreated',
      "GitHub issue wasn't created"
    ),
    description: [
      asSentence(normalizedFailureMessage(failure.error)),
      translate(
        'auto.components.crash.report.submit.notice.checkGh',
        'Check your connection and `gh` sign-in and try again, or copy the details.'
      )
    ].join(' '),
    actionLabel: translate('auto.components.crash.report.submit.notice.copyDetails', 'Copy Details')
  }
}
