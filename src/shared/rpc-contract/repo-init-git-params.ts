import type { Repo } from '../repo-types'

// `repo.initGit`: the host that owns a folder project runs `git init` plus an empty first commit in
// that project's own path, then the project becomes a normal Git project. Params are the shared
// `{ repo }` selector.

/** Positively observed refusals. Transport loss and an older host are never one of these. */
export const REPO_INIT_GIT_ERRORS = [
  'repo_not_found',
  'not_a_folder_project',
  'has_folder_workspaces',
  'host_unavailable',
  'not_a_repository_root',
  'git_init_failed',
  'git_identity_unavailable',
  'git_commit_failed'
] as const

export type RepoInitGitError = (typeof REPO_INIT_GIT_ERRORS)[number]

export type RepoInitGitResult =
  | { ok: true; repo: Repo }
  // `message` is git's own text for the init and commit failures, for display only.
  | { ok: false; error: RepoInitGitError; message?: string }
