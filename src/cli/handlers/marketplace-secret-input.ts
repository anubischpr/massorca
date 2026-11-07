import { getOptionalStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'

const MAX_SECRET_BYTES = 8192

async function readStdinSecret(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--token-stdin needs the token piped in; stdin is a terminal.'
    )
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_SECRET_BYTES) {
      throw new RuntimeClientError('invalid_argument', 'The token on stdin is too long.')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

/**
 * A secret from `--<name>-stdin` or the env var `--<name>-env` names; never from argv, where
 * process listings and shell history would keep it. Error messages never include the value.
 */
export async function readSecretInput(
  flags: Map<string, string | boolean>,
  name: string
): Promise<string | undefined> {
  const fromStdin = flags.get(`${name}-stdin`) === true
  const envName = getOptionalStringFlag(flags, `${name}-env`)
  if (fromStdin && envName !== undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Use either --${name}-stdin or --${name}-env, not both.`
    )
  }
  if (flags.has(name)) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--${name} is not accepted on the command line; use --${name}-stdin or --${name}-env.`
    )
  }
  if (!fromStdin && envName === undefined) {
    return undefined
  }
  const value = fromStdin ? await readStdinSecret() : (process.env[envName ?? '']?.trim() ?? '')
  if (value.length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      fromStdin ? 'No token arrived on stdin.' : `The env var ${envName} is empty or unset.`
    )
  }
  return value
}
