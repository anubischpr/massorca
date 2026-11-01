/**
 * The `feedback:submit` IPC contract. Shared so the preload bridge's declared
 * shape cannot drift from what the main-process handler actually returns.
 */

export type FeedbackSubmitArgs = {
  feedback: string
}

export type FeedbackSubmitResult =
  | { ok: true; url: string }
  | { ok: false; status: number | null; error: string }
