import type {
  AgentJournalRenderItem,
  AgentJournalToolCallItem
} from './agent-session-journal-types'
import { nativeChatProseToMarkdown } from './native-chat-prose'
import { isShellActivityToolCall } from './native-chat-tool-icon'
import { mcpToolIdentity } from './native-chat-tool-identity'

/** Where the journal reported an environment URL: a command's or deploy tool's output, or the
 *  main agent's own reply naming it as the place to test. */
export type NativeChatEnvironmentUrlSource = 'tool-output' | 'agent-reply'

/** An environment URL the Results card lists. `previous` marks one a newer URL of the same
 *  environment replaced; it is kept, not dropped. */
export type NativeChatEnvironmentUrl = {
  url: string
  source: NativeChatEnvironmentUrlSource
  itemId: string
  /** Whether the host is loopback or private, so a remote session's URL lives on that host. */
  loopback: boolean
  previous: boolean
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]}|\\]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?*_~]+$/

// Background-output readers carry a dev server's banner after the command that started it.
const BACKGROUND_OUTPUT_TOOL_NAMES = new Set(['bashoutput', 'taskoutput', 'write_stdin'])

const PREVIEW_HOSTING_SUFFIXES = [
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'fly.dev',
  'onrender.com',
  'up.railway.app',
  'herokuapp.com',
  'ngrok.io',
  'ngrok.app',
  'ngrok-free.app',
  'trycloudflare.com',
  'loca.lt',
  'azurestaticapps.net',
  'azurewebsites.net',
  'web.app',
  'firebaseapp.com',
  'amplifyapp.com',
  'github.io',
  'surge.sh',
  'deno.dev',
  'run.app',
  'expo.app'
]

const ENVIRONMENT_LABELS = new Set([
  'preview',
  'staging',
  'stage',
  'stg',
  'dev',
  'test',
  'qa',
  'uat',
  'sandbox',
  'demo',
  'beta'
])

const EXCLUDED_HOSTS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'dev.azure.com',
  'npmjs.com',
  'npmjs.org',
  'pypi.org',
  'stackoverflow.com',
  'readthedocs.io',
  'readthedocs.org',
  'atlassian.net',
  'linear.app',
  'claude.ai',
  'claude.com',
  'anthropic.com',
  'openai.com'
]

const EXCLUDED_HOST_PREFIXES = ['docs.', 'developer.', 'developers.', 'learn.', 'api.github.']
const EXCLUDED_PATH = /\/(issues|pull|pulls|merge_requests|commit|commits|blob|tree)\//i

/** Words that mark a reply line as handing over a URL to try. */
const HANDOFF_WORDS =
  /\b(test|testing|try|preview|staging|deploy(ed|ment)?|live|environment|available at|running at|open|url|probar|prueba|ambiente|entorno|desplieg\w*|disponible)\b/i

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function isPrivateHost(host: string): boolean {
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    host === '0.0.0.0'
  ) {
    return true
  }
  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false
  }
  const [a = -1, b = -1] = octets
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

function isExcluded(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (
    EXCLUDED_HOSTS.some((domain) => hostMatches(host, domain)) ||
    EXCLUDED_HOST_PREFIXES.some((prefix) => host.startsWith(prefix)) ||
    EXCLUDED_PATH.test(url.pathname)
  )
}

/** A URL that names a place to run the app: loopback/private, an explicit port, a preview host,
 *  or a subdomain labeled preview/staging/test. Docs, forges, issues and PRs never count. */
export function isEnvironmentUrl(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url || isExcluded(url)) {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (isPrivateHost(host) || url.port !== '') {
    return true
  }
  if (PREVIEW_HOSTING_SUFFIXES.some((suffix) => hostMatches(host, suffix))) {
    return true
  }
  // Only subdomain labels: the registrable name and TLD (`dev.to`, `.dev`) say nothing.
  return host
    .split('.')
    .slice(0, -2)
    .some((label) => label.split('-').some((part) => ENVIRONMENT_LABELS.has(part)))
}

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function urlsInText(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
}

/** The key two URLs of one environment share: the origin for loopback and ported URLs, else the
 *  parent domain, so a new `app-<hash>.vercel.app` deploy replaces the last one. */
function environmentKey(url: URL): string {
  const host = url.hostname.toLowerCase()
  if (isPrivateHost(host) || url.port !== '') {
    return url.origin
  }
  const labels = host.split('.')
  return labels.length > 2 ? labels.slice(1).join('.') : host
}

function normalizeUrl(raw: string): string {
  return raw.replace(/\/$/, '')
}

/** Commands, background-output reads and connector (deploy) tools; a file read's output is source
 *  text, where a URL is code and not a running environment. */
function isUrlProducingTool(body: AgentJournalToolCallItem): boolean {
  return (
    isShellActivityToolCall(body) ||
    BACKGROUND_OUTPUT_TOOL_NAMES.has(body.name.trim().toLowerCase()) ||
    mcpToolIdentity(body.name, body.mcpIdentity) !== null
  )
}

type Mention = { url: string; source: NativeChatEnvironmentUrlSource; itemId: string }

function mentionsInItem(item: AgentJournalRenderItem): Mention[] {
  const { body, itemId, agentId } = item
  if (body.kind === 'tool-call') {
    if (!body.output || !isUrlProducingTool(body)) {
      return []
    }
    return urlsInText(body.output.head)
      .filter(isEnvironmentUrl)
      .map((url) => ({ url, source: 'tool-output', itemId }))
  }
  // Only the main agent's replies: a prompt or a subagent's words are not the hand-over.
  if (body.kind !== 'message' || body.role !== 'assistant' || agentId !== undefined) {
    return []
  }
  return nativeChatProseToMarkdown(body.blocks)
    .split('\n')
    .flatMap((line) =>
      urlsInText(line).filter((url) => {
        const parsed = parseUrl(url)
        return (
          parsed !== null &&
          !isExcluded(parsed) &&
          (isEnvironmentUrl(url) || HANDOFF_WORDS.test(line))
        )
      })
    )
    .map((url) => ({ url, source: 'agent-reply', itemId }))
}

/** The chat's environment URLs, newest mention first, one row per URL. The newest URL of each
 *  environment is current; older ones of the same environment are `previous`. */
export function environmentUrlsFromJournalItems(
  items: readonly AgentJournalRenderItem[]
): NativeChatEnvironmentUrl[] {
  const seen = new Set<string>()
  const currentEnvironments = new Set<string>()
  const urls: NativeChatEnvironmentUrl[] = []
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const mentions = mentionsInItem(items[index]!)
    for (let position = mentions.length - 1; position >= 0; position -= 1) {
      const mention = mentions[position]!
      const url = normalizeUrl(mention.url)
      const parsed = parseUrl(url)
      if (!parsed || seen.has(url)) {
        continue
      }
      seen.add(url)
      const key = environmentKey(parsed)
      const previous = currentEnvironments.has(key)
      currentEnvironments.add(key)
      urls.push({
        url,
        source: mention.source,
        itemId: mention.itemId,
        loopback: isPrivateHost(parsed.hostname.toLowerCase()),
        previous
      })
    }
  }
  return urls
}
