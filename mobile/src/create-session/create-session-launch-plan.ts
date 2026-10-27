import { narrowStructuredLaunchSeedOptions } from '../../../src/shared/native-chat-session-option-defaults'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  effectiveWorkspaceMode,
  type CreateSessionSelection,
  type CreateSessionWorkspaceMode
} from './create-session-model'

/** What the user explicitly picked in the composer row; unset means "the host's own default". */
export type CreateSessionPicks = {
  model?: string
  effort?: string
  fastMode?: boolean
  accessMode?: string
}

export type CreateSessionLaunchPlan = {
  kind: CreateSessionWorkspaceMode
  repoId: string
  agent: TuiAgent
  prompt: string
  /** Absent when nothing was picked, so the host seeds the saved defaults itself. */
  sessionOptions?: Record<string, string>
}

/**
 * The options a create seeds the chat with. OpenCode gets none: the host refuses its launch when
 * any option rides along without a verifiable model, and creating the session matters more.
 * An effort or fast pick travels with the model it was made against, as the host reads them as a pair.
 */
export function createSessionSeedOptions(
  agent: TuiAgent,
  picks: CreateSessionPicks,
  effectiveModelId: string | null
): Record<string, string> | undefined {
  if (agent === 'opencode') {
    return undefined
  }
  const pairedModel =
    picks.model ??
    (picks.effort !== undefined || picks.fastMode !== undefined
      ? (effectiveModelId ?? undefined)
      : undefined)
  return narrowStructuredLaunchSeedOptions({
    ...(pairedModel ? { model: pairedModel } : {}),
    ...(picks.effort ? { effort: picks.effort } : {}),
    ...(picks.fastMode !== undefined ? { fastMode: picks.fastMode } : {}),
    ...(picks.accessMode ? { accessMode: picks.accessMode } : {})
  })
}

export function buildCreateSessionLaunchPlan(args: {
  draft: string
  selection: CreateSessionSelection
  repo: MobileWorkspaceRepo | null
  picks: CreateSessionPicks
  effectiveModelId: string | null
}): CreateSessionLaunchPlan | null {
  const { draft, selection, repo } = args
  const prompt = draft.trim()
  if (!repo || !selection.agent || prompt === '') {
    return null
  }
  const sessionOptions = createSessionSeedOptions(
    selection.agent,
    args.picks,
    args.effectiveModelId
  )
  return {
    kind: effectiveWorkspaceMode(selection, repo),
    repoId: repo.id,
    agent: selection.agent,
    prompt,
    ...(sessionOptions ? { sessionOptions } : {})
  }
}

export type CreateSessionStep = { id: 'worktree' | 'setup' | 'agent'; label: string }

/** Current checkout skips the worktree steps, as in the prototype. */
export function createSessionProgressSteps(
  plan: Pick<CreateSessionLaunchPlan, 'kind'>,
  agentLabel: string
): CreateSessionStep[] {
  const agent: CreateSessionStep = { id: 'agent', label: `Starting ${agentLabel}` }
  if (plan.kind === 'current-checkout') {
    return [agent]
  }
  return [
    { id: 'worktree', label: 'Creating the worktree' },
    { id: 'setup', label: 'Running setup in the background' },
    agent
  ]
}
