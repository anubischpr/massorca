import { ipcMain } from 'electron'
import { createIssueInRepository } from '../github/issue-create'
import { stripClientEnvironmentFooter } from '../../shared/client-environment-info'
import { MASSORCA_GITHUB_REPO } from '../../shared/massorca-distribution'
import type {
  FeedbackSubmitArgs,
  FeedbackSubmitResult
} from '../../shared/feedback-submit-contract'

const MAX_TITLE_SUMMARY_LENGTH = 80
const [REPORT_REPO_OWNER = '', REPORT_REPO_NAME = ''] = MASSORCA_GITHUB_REPO.split('/')

type InternalFeedbackSubmitArgs = FeedbackSubmitArgs & { title?: string }

function buildFeedbackTitle(feedback: string): string {
  const summary =
    stripClientEnvironmentFooter(feedback)
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? 'New report'
  return summary.length > MAX_TITLE_SUMMARY_LENGTH
    ? `Feedback: ${summary.slice(0, MAX_TITLE_SUMMARY_LENGTH - 1)}…`
    : `Feedback: ${summary}`
}

export async function submitFeedback(
  args: InternalFeedbackSubmitArgs
): Promise<FeedbackSubmitResult> {
  try {
    // Why: no repo binding, so `gh` publishes as its active account. The target
    // is pinned because issue-source resolution on a fork can pick upstream.
    const result = await createIssueInRepository(
      { owner: REPORT_REPO_OWNER, repo: REPORT_REPO_NAME },
      { encoding: 'utf-8' },
      args.title ?? buildFeedbackTitle(args.feedback),
      args.feedback
    )
    return result.ok
      ? { ok: true, url: result.url }
      : { ok: false, status: null, error: result.error }
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function registerFeedbackHandlers(): void {
  ipcMain.removeHandler('feedback:submit')
  ipcMain.handle('feedback:submit', async (_event, args: FeedbackSubmitArgs) => {
    if (typeof args?.feedback !== 'string') {
      return { ok: false, status: null, error: 'Feedback text is required.' }
    }
    // Why: the renderer is untrusted, so it supplies the body and nothing else.
    return submitFeedback({ feedback: args.feedback })
  })
}
