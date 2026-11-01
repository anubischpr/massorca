import type { RpcClient } from '../transport/rpc-client'

const clientKeys = new WeakMap<RpcClient, number>()
let nextClientKey = 0

/** A number per paired host's client, for cache keys: one host's files never answer for another's. */
export function rpcClientKey(client: RpcClient): number {
  let key = clientKeys.get(client)
  if (key === undefined) {
    nextClientKey += 1
    key = nextClientKey
    clientKeys.set(client, key)
  }
  return key
}
