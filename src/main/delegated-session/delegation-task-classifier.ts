import type {
  DelegationDimensionLevel,
  DelegationTaskDimensions,
  DelegationTier
} from '../../shared/delegated-session-types'

export type DelegationClassificationInput = {
  summary: string
  writesCode: boolean
}

export type DelegationClassification = {
  dimensions: DelegationTaskDimensions
  tier: DelegationTier
  /** True when high risk raised the tier to the floor of 4. */
  riskFloorApplied: boolean
}

type LevelRule = { level: DelegationDimensionLevel; pattern: RegExp }

// Why: a keyword matches at a word start, so "test" hits "tests" but not "latest".
function levelRule(level: DelegationDimensionLevel, words: readonly string[]): LevelRule {
  return { level, pattern: new RegExp(`\\b(?:${words.join('|')})`, 'i') }
}

// Rules run in order; the first match wins and the fallback applies when none matches.
const RISK_RULES = [
  levelRule('high', [
    'security',
    // Why: bare "auth" would also match "author".
    'auth\\b',
    'authenticat',
    'authoriz',
    'permission',
    'payment',
    'migration',
    'delete',
    'production',
    'credential',
    'data loss',
    // Why: only shipping a release is risky; reading release notes is not.
    'cut a release',
    'release to',
    'publish a release',
    'ship a release'
  ])
]

// Why: a substantive verb outranks a routine one, so "implement the lint rule" stays medium.
const COMPLEXITY_RULES = [
  levelRule('high', [
    'architecture',
    'refactor',
    'redesign',
    'cross-cutting',
    'concurrency',
    'distributed',
    'multi-module',
    'system-wide'
  ]),
  levelRule('medium', ['implement', 'integrat', 'explore', 'investigat', 'compare', 'debug']),
  levelRule('low', ['typo', 'rename', 'format', 'lint', 'docs', 'bump', 'routine'])
]

const VERIFIABILITY_RULES = [
  levelRule('high', ['test', 'typecheck', 'lint', 'reproduc', 'deterministic']),
  levelRule('low', ['design', 'ux', 'research', 'explore', 'investigat', 'decide'])
]

const AMBIGUITY_RULES = [
  levelRule('high', [
    'unclear',
    'unknown',
    'decide',
    'design',
    'proposal',
    'tradeoff',
    'investigat'
  ]),
  levelRule('low', ['exact', 'specific', 'rename', 'bump'])
]

const LEVEL_POINTS: Readonly<Record<DelegationDimensionLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2
}

// Why: hard-to-verify work scores up, so verifiability is inverted.
const VERIFIABILITY_POINTS: Readonly<Record<DelegationDimensionLevel, number>> = {
  high: 0,
  medium: 1,
  low: 2
}

function levelFrom(
  summary: string,
  rules: readonly LevelRule[],
  fallback: DelegationDimensionLevel
): DelegationDimensionLevel {
  return rules.find((rule) => rule.pattern.test(summary))?.level ?? fallback
}

function tierForPoints(points: number): DelegationTier {
  if (points <= 1) {
    return 1
  }
  if (points <= 3) {
    return 2
  }
  if (points <= 5) {
    return 3
  }
  return points <= 7 ? 4 : 5
}

export function classifyDelegationTask({
  summary,
  writesCode
}: DelegationClassificationInput): DelegationClassification {
  const dimensions: DelegationTaskDimensions = {
    risk: levelFrom(summary, RISK_RULES, writesCode ? 'medium' : 'low'),
    complexity: levelFrom(summary, COMPLEXITY_RULES, 'medium'),
    verifiability: levelFrom(summary, VERIFIABILITY_RULES, 'medium'),
    ambiguity: levelFrom(summary, AMBIGUITY_RULES, 'medium')
  }
  const points =
    LEVEL_POINTS[dimensions.risk] +
    LEVEL_POINTS[dimensions.complexity] +
    VERIFIABILITY_POINTS[dimensions.verifiability] +
    LEVEL_POINTS[dimensions.ambiguity]
  const baseTier = tierForPoints(points)
  const riskFloorApplied = dimensions.risk === 'high' && baseTier < 4
  return { dimensions, tier: riskFloorApplied ? 4 : baseTier, riskFloorApplied }
}
