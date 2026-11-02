import { describe, expect, it } from 'vitest'
import {
  getCrashReportCopySubmissionFailure,
  getCrashReportSubmitFailureNotice
} from './crash-report-submit-notice'

describe('crash report submit notice', () => {
  it('keeps the returned error and points to gh sign-in and copying', () => {
    expect(getCrashReportSubmitFailureNotice({ error: 'gh auth required' })).toEqual({
      title: "GitHub issue wasn't created",
      description:
        'gh auth required. Check your connection and `gh` sign-in and try again, or copy the details.',
      actionLabel: 'Copy Details'
    })
  })

  it('safely surfaces Error messages and ignores unhelpful rejected values', () => {
    expect(getCrashReportSubmitFailureNotice({ error: new Error('boom') }).description).toContain(
      'boom.'
    )
    expect(getCrashReportSubmitFailureNotice({ error: { nope: true } }).description).toContain(
      'The crash report request failed before it returned a reason.'
    )
  })

  it('redacts paths before displaying or copying errors', () => {
    const failure = { error: 'failed at /Users/alice/project/file.ts' }

    expect(getCrashReportSubmitFailureNotice(failure).description).not.toContain('alice')
    expect(getCrashReportCopySubmissionFailure(failure).error).not.toContain('alice')
  })
})
