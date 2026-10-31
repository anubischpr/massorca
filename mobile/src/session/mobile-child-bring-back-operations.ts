import { z } from 'zod'
import { ChildBringBackStatus } from '../../../src/shared/child-bring-back'
import type { ChildBringBackCall } from '../../../src/shared/use-child-bring-back'
import { defineRpcOperation, runRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'

const TIMEOUT_MS = 120_000

const statusOperation = defineRpcOperation({
  name: 'orchestration.child-bring-back-status',
  method: 'orchestration.childBringBackStatus',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const bringBackOperation = defineRpcOperation({
  name: 'orchestration.child-bring-back',
  method: 'orchestration.childBringBack',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const abortOperation = defineRpcOperation({
  name: 'orchestration.child-bring-back-abort',
  method: 'orchestration.childBringBackAbort',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const resolveOperation = defineRpcOperation({
  name: 'orchestration.child-bring-back-resolve',
  method: 'orchestration.childBringBackResolve',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('accepted', z.object({ ok: z.literal(true) }))
})

/** The notice's calls over this phone's host connection, each read through its declared shape. */
export function mobileChildBringBackCall(client: UnvalidatedRpcRequestPort): ChildBringBackCall {
  const options = { timeoutMs: TIMEOUT_MS, budgetSpansConnect: true }
  return (method, params) => {
    switch (method) {
      case 'orchestration.childBringBackStatus':
        return runRpcOperation(client, statusOperation, params, options)
      case 'orchestration.childBringBack':
        return runRpcOperation(client, bringBackOperation, params, options)
      case 'orchestration.childBringBackAbort':
        return runRpcOperation(client, abortOperation, params, options)
      case 'orchestration.childBringBackResolve':
        return runRpcOperation(client, resolveOperation, params, options)
    }
  }
}
