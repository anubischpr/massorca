import { z } from 'zod'
import { ChildBringBackStatus } from '../../../src/shared/child-bring-back'
import type { ChildBringBackCall } from '../../../src/shared/child-bring-back-controller'
import { defineRpcOperation, runRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'

const TIMEOUT_MS = 120_000

const statusOperation = defineRpcOperation({
  name: 'delegation.bring-back-status',
  method: 'delegation.bringBackStatus',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const bringBackOperation = defineRpcOperation({
  name: 'delegation.bring-back',
  method: 'delegation.bringBack',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const abortOperation = defineRpcOperation({
  name: 'delegation.bring-back-abort',
  method: 'delegation.bringBackAbort',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('status', ChildBringBackStatus)
})

const resolveOperation = defineRpcOperation({
  name: 'delegation.bring-back-resolve',
  method: 'delegation.bringBackResolve',
  acceptance: 'require-result-or-throw-message',
  barrier: 'on-settle',
  read: rpcResultVariant('accepted', z.object({ ok: z.literal(true) }))
})

/** The notice's calls over this phone's host connection, each read through its declared shape. */
export function mobileChildBringBackCall(client: UnvalidatedRpcRequestPort): ChildBringBackCall {
  const options = { timeoutMs: TIMEOUT_MS, budgetSpansConnect: true }
  return (method, params) => {
    switch (method) {
      case 'delegation.bringBackStatus':
        return runRpcOperation(client, statusOperation, params, options)
      case 'delegation.bringBack':
        return runRpcOperation(client, bringBackOperation, params, options)
      case 'delegation.bringBackAbort':
        return runRpcOperation(client, abortOperation, params, options)
      case 'delegation.bringBackResolve':
        return runRpcOperation(client, resolveOperation, params, options)
    }
  }
}
