import { gitExecFileAsync, gitExecFileAsyncBuffer } from '../git/command-runner/git-exec-file'

export type BotTeamSnapshotGitOptions = {
  cwd: string
  stdin?: string
  /** Replaces the private index file; every command is bound to the private repository. */
  indexFile?: string
  env?: Record<string, string>
}

/** The two ways the snapshot service reaches Git; tests and other hosts can bring their own. */
export type BotTeamSnapshotGit = {
  text: (args: string[], options: BotTeamSnapshotGitOptions) => Promise<string>
  bytes: (args: string[], options: BotTeamSnapshotGitOptions) => Promise<Buffer>
}

const MAX_LISTING_BYTES = 64 * 1024 * 1024

// Anything that could point Git at the user's own repository instead of the private one.
const INHERITED_REPOSITORY_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_PREFIX'
]

// Only options Git 2.25 knows; the bytes of a file must come back exactly as they went in.
const FIXED_CONFIG = [
  '-c',
  'core.autocrlf=false',
  '-c',
  'core.safecrlf=false',
  '-c',
  'core.quotepath=false',
  '-c',
  'core.longpaths=true',
  '-c',
  'commit.gpgsign=false'
]

function commandEnv(
  gitDir: string | null,
  workTree: string,
  options: BotTeamSnapshotGitOptions
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of INHERITED_REPOSITORY_ENV) {
    delete env[key]
  }
  if (gitDir !== null) {
    env.GIT_DIR = gitDir
    env.GIT_WORK_TREE = workTree
  }
  if (options.indexFile) {
    env.GIT_INDEX_FILE = options.indexFile
  }
  return { ...env, ...options.env }
}

/** Runs the user's Git on this host against `gitDir`, a repository that lives outside the folder. */
export function createBotTeamSnapshotGit(gitDir: string | null): BotTeamSnapshotGit {
  const prepare = (args: string[], options: BotTeamSnapshotGitOptions) => ({
    args: [...FIXED_CONFIG, ...args],
    // `init` creates the private repository, so it cannot already be bound to it.
    env: commandEnv(args[0] === 'init' ? null : gitDir, options.cwd, options)
  })
  return {
    text: async (args, options) => {
      const run = prepare(args, options)
      const { stdout } = await gitExecFileAsync(run.args, {
        cwd: options.cwd,
        env: run.env,
        maxBuffer: MAX_LISTING_BYTES,
        admissionTier: 'background',
        ...(options.stdin === undefined ? {} : { stdin: options.stdin })
      })
      return stdout
    },
    bytes: async (args, options) => {
      const run = prepare(args, options)
      const { stdout } = await gitExecFileAsyncBuffer(run.args, {
        cwd: options.cwd,
        env: run.env,
        maxBuffer: MAX_LISTING_BYTES,
        admissionTier: 'background'
      })
      return stdout
    }
  }
}
