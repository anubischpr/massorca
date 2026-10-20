import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import type {
  ProviderRateLimits,
  RateLimitBucket,
  UsageRateLimitFailureKind
} from '../../shared/rate-limit-types'
import type { NanGatewayCredentialReadResult } from './nan-gateway-credentials'

// Why: the NaN Cloud dashboard backend; it is outside NaN's published OpenAPI, so the
// parser trusts nothing and the request refuses redirects to keep the bearer on this origin.
const NAN_QUOTA_URL = 'https://cloud-api.nan.builders/api/usage/quota'
const API_TIMEOUT_MS = 15_000
// Why: the payload carries per-model reset dates but no period length; NaN bills monthly.
const NAN_PERIOD_MINUTES = 30 * 24 * 60

function snapshot(
  status: ProviderRateLimits['status'],
  error: string | null,
  extra: Partial<ProviderRateLimits> = {}
): ProviderRateLimits {
  return {
    provider: 'nan',
    session: null,
    weekly: null,
    monthly: null,
    updatedAt: Date.now(),
    error,
    status,
    ...extra
  }
}

function failed(
  error: string,
  failureKind: UsageRateLimitFailureKind,
  apiKey: string
): ProviderRateLimits {
  return snapshot('error', error.replaceAll(apiKey, '[redacted]'), {
    usageMetadata: { source: 'web', failureKind }
  })
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function resetTime(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isNaN(parsed) ? null : parsed
}

// Why: `cap` is prorated on a first period, so the dashboard divides by `fullCap` when present.
function readAllowance(model: Record<string, unknown>): number | null {
  return positiveNumber(model.fullCap) ?? positiveNumber(model.cap)
}

/** Returns null when a metered model's usage is unreadable: a partial snapshot would understate the account. */
function parseModelBuckets(models: unknown[]): RateLimitBucket[] | null {
  const buckets: RateLimitBucket[] = []
  for (const entry of models) {
    if (!isRecord(entry) || typeof entry.model !== 'string' || entry.model.length === 0) {
      continue
    }
    const allowance = readAllowance(entry)
    // Why: the dashboard draws nothing for a model without an allowance, and the live payload lists such entries.
    if (allowance === null) {
      continue
    }
    const used = entry.tokensUsed
    if (typeof used !== 'number' || !Number.isFinite(used) || used < 0) {
      return null
    }
    buckets.push({
      name: entry.model,
      usedPercent: Math.min(100, (used / allowance) * 100),
      windowMinutes: NAN_PERIOD_MINUTES,
      resetsAt: resetTime(entry.periodEnd),
      resetDescription: null
    })
  }
  return buckets
}

/**
 * Read-only subscription usage for the NaN gateway behind Gentle Shell: one
 * allowance per metered model, with the most-used model as the headline.
 */
export async function fetchNanRateLimits(options: {
  credential: NanGatewayCredentialReadResult
  signal?: AbortSignal
}): Promise<ProviderRateLimits> {
  const { credential } = options
  if (credential.status !== 'ok') {
    return snapshot('unavailable', 'NaN gateway key is not configured', {
      usageMetadata: { source: 'web', failureKind: 'missing-credentials' }
    })
  }
  const { apiKey } = credential

  let response: Response
  try {
    const timeout = AbortSignal.timeout(API_TIMEOUT_MS)
    response = await fetch(NAN_QUOTA_URL, {
      method: 'GET',
      redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'User-Agent': 'orca' },
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    })
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : 'NaN usage request failed',
      'network',
      apiKey
    )
  }
  if (!response.ok) {
    await cancelUnreadResponseBody(response)
    return failed(`NaN usage request failed (HTTP ${response.status})`, 'server', apiKey)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return failed('Could not parse NaN usage response', 'parse', apiKey)
  }
  const models = isRecord(payload) && Array.isArray(payload.models) ? payload.models : null
  const buckets = models ? parseModelBuckets(models) : null
  if (!buckets || buckets.length === 0) {
    return failed('NaN usage response contained no usable allowances', 'parse', apiKey)
  }

  buckets.sort((left, right) => right.usedPercent - left.usedPercent)
  const { usedPercent, windowMinutes, resetsAt, resetDescription } = buckets[0]
  return snapshot('ok', null, {
    monthly: { usedPercent, windowMinutes, resetsAt, resetDescription },
    buckets,
    usageMetadata: { source: 'web' }
  })
}
