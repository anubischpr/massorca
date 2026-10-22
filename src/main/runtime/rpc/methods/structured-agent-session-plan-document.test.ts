import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { antigravityProviderHandle } from '../../../../shared/agent-session-provider-handle-encoding'
import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../../../shared/agent-session-record.test-fixture'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { ALL_RPC_METHODS } from '.'
import { STRUCTURED_AGENT_SESSION_PLAN_DOCUMENT_METHODS } from './structured-agent-session-plan-document'
import {
  call as callStructured,
  clearStructuredHostStub,
  hostStub,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

const CONVERSATION = 'conv-1'
let root: string
let record: AgentSessionRecord | null

const call = (params: unknown) =>
  callStructured(
    'agentSession.readPlanDocument',
    params,
    STRUCTURED_CLIENT,
    {},
    STRUCTURED_AGENT_SESSION_PLAN_DOCUMENT_METHODS
  )

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-plan-rpc-'))
  const base = agentSessionRecordFixture()
  record = {
    ...base,
    sessionId: SESSION,
    providerHandleChain: [
      {
        ...base.providerHandleChain[0]!,
        handle: antigravityProviderHandle(CONVERSATION)
      }
    ]
  }
  setStructuredAgentSessionHost(
    Object.assign(hostStub(), {
      deps: { store: { getRecord: (id: string) => (record?.sessionId === id ? record : null) } }
    })
  )
})

afterEach(async () => {
  clearStructuredHostStub()
  await rm(root, { recursive: true, force: true })
})

async function writePlan(): Promise<string> {
  const folder = join(root, 'brain', CONVERSATION)
  await mkdir(folder, { recursive: true })
  const path = join(folder, 'plan.md')
  await writeFile(path, '# Plan')
  await writeFile(`${path}.metadata.json`, JSON.stringify({ userFacing: true, summary: 's' }))
  return path
}

describe('agentSession.readPlanDocument', () => {
  it('is registered on the runtime manifest', () => {
    expect(ALL_RPC_METHODS.map((method) => method.name)).toContain('agentSession.readPlanDocument')
  })

  it("reads the document inside the session's own conversation folder", async () => {
    const path = await writePlan()
    expect(await call({ sessionId: SESSION, path })).toMatchObject({
      ok: true,
      result: { ok: true, text: '# Plan' }
    })
  })

  it('refuses a path of another conversation and a session with no record', async () => {
    const path = await writePlan()
    const other = path.replace(CONVERSATION, 'conv-2')
    expect(await call({ sessionId: SESSION, path: other })).toMatchObject({
      ok: true,
      result: { ok: false, error: 'outside_folder' }
    })
    record = null
    expect(await call({ sessionId: SESSION, path })).toMatchObject({
      ok: true,
      result: { ok: false, error: 'session_not_found' }
    })
  })

  it('refuses a chat recorded on another execution host', async () => {
    const path = await writePlan()
    const base = agentSessionRecordFixture()
    record = {
      ...record!,
      location: { ...base.location, executionHostId: 'ssh:box' }
    }
    expect(await call({ sessionId: SESSION, path })).toMatchObject({
      ok: true,
      result: { ok: false, error: 'unsupported_location' }
    })
  })
})
