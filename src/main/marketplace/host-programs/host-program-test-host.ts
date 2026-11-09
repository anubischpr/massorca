import { HOME_SCRIPT, LOCAL_APP_DATA_SCRIPT } from './host-program-plan'
import type { HostExecutor, HostPlatform, RunResult, WhichResult } from './host-program-types'

export type FakeHost = HostExecutor & {
  calls: string[]
  present: Map<string, string>
}

type FakeHostOptions = {
  platform: HostPlatform
  /** Commands on the host's PATH, with their paths. */
  present?: Record<string, string>
  /** The answer to one command, keyed by its argv joined with spaces or `script:<text>`. */
  answers?: Record<string, Partial<RunResult>>
  /** Runs after the command answered, e.g. to make a program appear once it is installed. */
  effects?: Record<string, (host: FakeHost) => void>
  osRelease?: string
  uid?: string
  /** The host's home folder (POSIX); null makes the lookup fail. */
  home?: string | null
  /** The host's LOCALAPPDATA (Windows); null makes the lookup fail. */
  localAppData?: string | null
  /** The host's USERPROFILE (Windows); null leaves it out of the answer. */
  userProfile?: string | null
  /** Answers for scripts by their text, for tests that must not repeat a long script. */
  scripts?: { match: RegExp; result?: Partial<RunResult>; effect?: (host: FakeHost) => void }[]
}

/** A host that records every command and answers from a table; nothing real is ever started. */
export function fakeHost(options: FakeHostOptions): FakeHost {
  const present = new Map(Object.entries(options.present ?? {}))
  const host: FakeHost = {
    platform: options.platform,
    calls: [],
    present,
    which: async (command): Promise<WhichResult> => {
      const path = present.get(command)
      return path ? { state: 'found', path } : { state: 'absent' }
    },
    run: async (argv) => answer(`${argv.join(' ')}`),
    script: async (script) => answer(`script:${script}`)
  }
  function answer(key: string): RunResult {
    host.calls.push(key)
    const base: RunResult = { code: 1, stdout: '', stderr: '', timedOut: false }
    let result: RunResult = base
    if (key === 'id -u') {
      result = { ...base, code: 0, stdout: `${options.uid ?? '1000'}\n` }
    } else if (key === 'cat /etc/os-release') {
      result = { ...base, code: 0, stdout: options.osRelease ?? 'ID=ubuntu\nID_LIKE=debian\n' }
    } else if (key === `script:${HOME_SCRIPT}`) {
      const home = options.home === undefined ? '/home/u' : options.home
      result = home === null ? base : { ...base, code: 0, stdout: home }
    } else if (key === `script:${LOCAL_APP_DATA_SCRIPT}`) {
      const dir =
        options.localAppData === undefined ? 'C:\\Users\\u\\AppData\\Local' : options.localAppData
      const profile = options.userProfile === undefined ? 'C:\\Users\\u' : options.userProfile
      result =
        dir === null
          ? base
          : { ...base, code: 0, stdout: profile === null ? dir : `${dir}\n${profile}` }
    } else if (key.endsWith(' --version') && present.has(key.slice(0, -' --version'.length))) {
      result = { ...base, code: 0, stdout: `${key.slice(0, -' --version'.length)} 1.2.3\n` }
    }
    const custom = options.answers?.[key]
    if (custom) {
      result = { ...result, ...custom }
    } else if (key.startsWith('sudo -n ') && key !== 'sudo -n true') {
      result = { ...result, code: 0 }
    }
    options.effects?.[key]?.(host)
    const script = key.startsWith('script:')
      ? options.scripts?.find((entry) => entry.match.test(key))
      : undefined
    if (script) {
      result = { ...result, code: 0, ...script.result }
      script.effect?.(host)
    }
    return result
  }
  return host
}
