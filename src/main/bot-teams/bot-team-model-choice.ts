import { classifyDelegationTask } from '../delegated-session/delegation-task-classifier'
import { resolveLaunchableDelegationModel } from '../delegated-session/delegation-launch-preferences'
import type { DelegationTier } from '../../shared/delegated-session-types'
import type { BotDraftInput, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'

// Why: the shared classifier's keywords are English, and job descriptions are often Spanish.
const SENIOR_JOB =
  /\b(?:arquitect|seguridad|migraci|produccion|pago|credencial|permiso|infraestructura|despliegue|critic|adversari)/

/**
 * A bot owns a session and can coordinate subagents, so it gets a capable tier for most work rather
 * than the smallest one that fits a single task.
 */
export function botTeamTier(job: string): DelegationTier {
  const { dimensions } = classifyDelegationTask({ summary: job, writesCode: false })
  const plain = job.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return dimensions.complexity === 'high' || dimensions.risk === 'high' || SENIOR_JOB.test(plain)
    ? 5
    : 4
}

export type BotModelChoice = Pick<BotTeamBot, 'modelMode' | 'model' | 'effort' | 'skills'>

function automaticChoice(agent: BotDraftInput['agent'], job: string, skills: string[]) {
  const { model, effort } = resolveLaunchableDelegationModel({ agent, tier: botTeamTier(job) })
  return { modelMode: 'auto' as const, model, effort, skills }
}

/** What a saved bot runs with: its own choice while it applies, otherwise picked from its job. */
export function resolveBotModelChoice(
  draft: BotDraftInput,
  existing?: Pick<BotTeamBot, 'agent'> & BotModelChoice
): BotModelChoice {
  const skills = draft.skills ?? existing?.skills ?? []
  // A model belongs to its agent, so changing the agent drops the old choice.
  const kept = existing?.agent === draft.agent ? existing : undefined
  const mode = draft.modelMode ?? kept?.modelMode ?? 'auto'
  const model = draft.model ?? kept?.model ?? null
  if (mode === 'manual' && model !== null) {
    return { modelMode: 'manual', model, effort: draft.effort ?? kept?.effort ?? null, skills }
  }
  return automaticChoice(draft.agent, draft.job, skills)
}

/** The session options a bot's task starts with; absent, the agent runs its own default. */
export function botLaunchOptions(
  bot: Pick<BotTeamBot, 'model' | 'effort'>
): Record<string, string> | undefined {
  return bot.model === null
    ? undefined
    : { model: bot.model, ...(bot.effort === null ? {} : { effort: bot.effort }) }
}
