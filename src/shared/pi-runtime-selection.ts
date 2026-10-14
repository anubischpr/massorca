export type PiRuntimeSelection = 'pi' | 'gentle-shell'

export function isPiRuntimeSelection(value: unknown): value is PiRuntimeSelection {
  return value === 'pi' || value === 'gentle-shell'
}

/** The client sends an identity; the executing host resolves its own executable path. */
export function selectedPiRuntime(command: string | undefined): PiRuntimeSelection {
  return /(?:^|[/\\])gentle-shell(?:\.(?:cmd|bat|exe))?$/i.test(command?.trim() ?? '')
    ? 'gentle-shell'
    : 'pi'
}

export function piRuntimeCommandSettings<
  T extends { agentCmdOverrides?: Partial<Record<string, string>> }
>(settings: T, runtime: PiRuntimeSelection) {
  const agentCmdOverrides = { ...settings.agentCmdOverrides }
  if (runtime === 'pi') {
    delete agentCmdOverrides.pi
  } else {
    agentCmdOverrides.pi = runtime
  }
  return { ...settings, agentCmdOverrides }
}
