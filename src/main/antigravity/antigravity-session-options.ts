/** Options an agy child takes at launch. A pick made while the child runs applies at its next start. */
export type AntigravityLaunchOptionKey = 'model' | 'effort'

const ANTIGRAVITY_LAUNCH_OPTION_KEYS: readonly AntigravityLaunchOptionKey[] = ['model', 'effort']
const ANTIGRAVITY_EFFORTS: readonly string[] = ['low', 'medium', 'high']

export function isAntigravityLaunchOptionKey(key: string): key is AntigravityLaunchOptionKey {
  return ANTIGRAVITY_LAUNCH_OPTION_KEYS.some((known) => known === key)
}

/** The reason a pick is unacceptable, or null. Launch resolution rejects any effort outside this set. */
export function antigravityLaunchOptionProblem(
  key: AntigravityLaunchOptionKey,
  value: string
): string | null {
  if (value.length === 0) {
    return `Antigravity ${key} must not be empty`
  }
  if (key === 'effort' && !ANTIGRAVITY_EFFORTS.includes(value)) {
    return 'Antigravity effort must be low, medium, or high'
  }
  return null
}

/** The values in force for the next start: the launch values with every recorded pick applied. */
export function antigravityOptionsInForce(
  launch: Readonly<Record<string, string>> | undefined,
  picks: ReadonlyMap<AntigravityLaunchOptionKey, string>
): Readonly<Record<string, string>> {
  const model: string | undefined = picks.get('model') ?? launch?.model
  const effort: string | undefined = picks.get('effort') ?? launch?.effort
  return {
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {})
  }
}

/** A live child reports what it launched with, and shows each pick as current until it starts again. */
export function antigravityLiveOptions(
  launch: Readonly<Record<string, string>> | undefined,
  picks: ReadonlyMap<AntigravityLaunchOptionKey, string>
): { models: []; current: { model?: string; effort?: string } } {
  const inForce = antigravityOptionsInForce(launch, picks)
  return {
    models: [],
    current: {
      ...(inForce.model ? { model: inForce.model } : {}),
      ...(inForce.effort ? { effort: inForce.effort } : {})
    }
  }
}
