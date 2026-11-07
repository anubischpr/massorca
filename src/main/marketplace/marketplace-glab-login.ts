import { findRunnableLocalCommand } from '../ipc/preflight-command-exec'
import { runProcess } from '../../shared/child-process/run-process'

export type GlabLoginOutcome = 'ok' | 'rejected' | 'not-installed' | 'failed'

const LOGIN_TIMEOUT_MS = 20_000
const MAX_LOGIN_OUTPUT_BYTES = 16 * 1024

/**
 * Signs the GitLab program in with a token read from its standard input, so the token never sits
 * in an argument list or the environment. `host` is a bare host (and port) for a self-hosted server.
 */
export async function glabLoginWithToken(
  token: string,
  host: string | null
): Promise<GlabLoginOutcome> {
  try {
    const probe = await findRunnableLocalCommand('glab')
    if (probe.status === 'absent') {
      return 'not-installed'
    }
    // Why: glab's --hostname rejects host:port, so a ported server goes through GITLAB_HOST instead.
    const ported = host !== null && /:\d+$/.test(host)
    const args = [
      'auth',
      'login',
      '--stdin',
      ...(host !== null && !ported ? ['--hostname', host] : [])
    ]
    const result = await runProcess({
      program: probe.binary,
      args,
      input: token,
      env: ported ? { ...process.env, GITLAB_HOST: host } : process.env,
      timeoutMs: LOGIN_TIMEOUT_MS,
      maxOutputBytes: MAX_LOGIN_OUTPUT_BYTES
    })
    // Why: glab's own words may repeat the host or the token, so only the exit code is kept.
    return result.code === 0 ? 'ok' : result.timedOut ? 'failed' : 'rejected'
  } catch {
    return 'failed'
  }
}
