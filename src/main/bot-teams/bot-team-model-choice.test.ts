import { describe, expect, it } from 'vitest'
import { resolveLaunchableDelegationModel } from '../delegated-session/delegation-launch-preferences'
import {
  botConversationChoice,
  botLaunchOptions,
  botSessionOptions,
  botTeamTier,
  resolveBotModelChoice
} from './bot-team-model-choice'

const DRAFT = { name: 'Nora', job: 'Writes offers and messages', agent: 'claude' as const }

describe('botTeamTier', () => {
  it.each([
    'Writes offers and messages',
    'Se encarga del backend de las aplicaciones',
    'Se encarga del front de las aplicaciónes, web, mobile, desktop.'
  ])('gives a capable tier to an ordinary job: %s', (job) => {
    expect(botTeamTier(job)).toBe(4)
  })

  it.each([
    'Owns the architecture of the platform',
    'Handles production security',
    'Se encarga de la infraestructura como código y creación del CI/CD',
    'Intenta ser crítico, como un juez adversario'
  ])('gives the top tier to a high-consequence job: %s', (job) => {
    expect(botTeamTier(job)).toBe(5)
  })
})

describe('botSessionOptions', () => {
  it("carries the team's access with the bot's model, since only Pi reads it at create", () => {
    expect(botSessionOptions({ model: 'sonnet' }, 'default')).toEqual({
      model: 'sonnet',
      accessMode: 'default'
    })
  })

  it("keeps the team's access when the bot runs its agent's default model", () => {
    expect(botSessionOptions(undefined, 'full-access')).toEqual({ accessMode: 'full-access' })
  })
})

describe('resolveBotModelChoice', () => {
  it('drops the old effort when the new model has none', () => {
    const existing = {
      agent: 'claude' as const,
      modelMode: 'manual' as const,
      model: 'opus',
      effort: 'high',
      skills: []
    }
    expect(
      resolveBotModelChoice(
        { ...DRAFT, modelMode: 'manual', model: 'haiku', effort: null },
        existing
      ).effort
    ).toBeNull()
    expect(
      resolveBotModelChoice({ ...DRAFT, modelMode: 'manual', model: 'opus' }, existing).effort
    ).toBe('high')
  })

  it('picks a model able to orchestrate when the bot is saved', () => {
    expect(resolveBotModelChoice(DRAFT)).toEqual({
      modelMode: 'auto',
      model: 'sonnet',
      effort: 'high',
      skills: []
    })
  })

  it('leaves the model to an agent the router has no table for', () => {
    expect(resolveBotModelChoice({ ...DRAFT, agent: 'antigravity' })).toMatchObject({
      modelMode: 'auto',
      model: null,
      effort: null
    })
  })

  it('recalculates when the job changes on an automatic bot', () => {
    const saved = { agent: 'claude' as const, ...resolveBotModelChoice(DRAFT) }
    const next = resolveBotModelChoice({ ...DRAFT, job: 'Owns the architecture' }, saved)
    expect(next).toMatchObject({ modelMode: 'auto', model: 'opus', effort: 'medium' })
  })

  it('keeps a person’s choice when the job changes', () => {
    const saved = {
      agent: 'claude' as const,
      modelMode: 'manual' as const,
      model: 'haiku',
      effort: 'low',
      skills: ['pdf']
    }
    expect(resolveBotModelChoice({ ...DRAFT, job: 'Owns the architecture' }, saved)).toEqual({
      modelMode: 'manual',
      model: 'haiku',
      effort: 'low',
      skills: ['pdf']
    })
  })

  it('returns to automatic when the agent changes', () => {
    const saved = {
      agent: 'claude' as const,
      modelMode: 'manual' as const,
      model: 'haiku',
      effort: 'low',
      skills: []
    }
    expect(resolveBotModelChoice({ ...DRAFT, agent: 'codex' }, saved)).toMatchObject({
      modelMode: 'auto',
      model: 'gpt-6.1-sol',
      effort: 'high'
    })
  })

  it('falls back to automatic when manual names no model', () => {
    expect(resolveBotModelChoice({ ...DRAFT, modelMode: 'manual' }).modelMode).toBe('auto')
  })

  it('keeps stored values when an older client omits the new fields', () => {
    const saved = {
      agent: 'claude' as const,
      modelMode: 'manual' as const,
      model: 'opus',
      effort: 'high',
      skills: ['pdf']
    }
    expect(resolveBotModelChoice(DRAFT, saved)).toEqual({
      modelMode: 'manual',
      model: 'opus',
      effort: 'high',
      skills: ['pdf']
    })
  })
})

describe('botLaunchOptions', () => {
  it('omits what is unset', () => {
    expect(botLaunchOptions({ model: null, effort: null })).toBeUndefined()
    expect(botLaunchOptions({ model: 'opus', effort: null })).toEqual({ model: 'opus' })
    expect(botLaunchOptions({ model: 'opus', effort: 'high' })).toEqual({
      model: 'opus',
      effort: 'high'
    })
  })
})

describe('botConversationChoice', () => {
  it('uses the capable tier of the same ladder as a task, never a name of its own', () => {
    const claude = botConversationChoice('claude')
    expect(claude).toEqual(resolveLaunchableDelegationModel({ agent: 'claude', tier: 4 }))
    expect(claude.model).not.toBeNull()
  })

  it('leaves an agent without a tiered model on its own default', () => {
    expect(botConversationChoice('gemini')).toEqual({ model: null, effort: null })
  })
})
