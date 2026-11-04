import type {
  MarketplaceCustomInstallEvent,
  MarketplaceCustomItem,
  MarketplaceCustomItemStatus,
  MarketplaceCustomResult
} from '../../../shared/marketplace-custom'
import {
  marketplacePlatform,
  parseAddArgs,
  parseIdArgs,
  type CustomItemDraft
} from './custom-item-args'
import type { CustomInstallRun, CustomItemEnv } from './custom-item-env'
import {
  detectCustomItemPresence,
  resolveInstallArgv,
  type CustomItemPresence
} from './custom-item-probe'
import type { StoredCustomItem } from './custom-item-store'

export type CustomItemService = {
  list: () => Promise<MarketplaceCustomItemStatus[]>
  add: (args: unknown) => Promise<MarketplaceCustomResult>
  remove: (args: unknown) => Promise<MarketplaceCustomResult>
  install: (
    args: unknown,
    onEvent: (event: MarketplaceCustomInstallEvent) => void
  ) => Promise<MarketplaceCustomResult>
}

type Refusal = Extract<MarketplaceCustomResult, { ok: false }>
/** A change to the stored list: the value it produced, or why it was refused. */
type Change<T> = { ok: true; value: T } | Refusal

function refuse(reason: Refusal['reason']): Refusal {
  return { ok: false, reason }
}

function sameName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function toItem(item: StoredCustomItem): MarketplaceCustomItem {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    checkCommand: item.checkCommand,
    install: item.install,
    ...(item.skillUrl === undefined ? {} : { skillUrl: item.skillUrl }),
    createdAt: item.createdAt
  }
}

/** Custom items on this computer: list them, add and remove them, and install them with MassOrca. */
export function createCustomItemService(env: CustomItemEnv): CustomItemService {
  const installing = new Set<string>()
  // Why: every change rewrites the whole list, so changes run one after another.
  let queue: Promise<unknown> = Promise.resolve()

  function serialize<T>(task: () => Change<T>): Promise<Change<T>> {
    const run = queue.then((): Change<T> => {
      try {
        return task()
      } catch {
        return refuse('failed')
      }
    })
    queue = run
    return run
  }

  async function status(
    item: StoredCustomItem,
    presence?: CustomItemPresence
  ): Promise<MarketplaceCustomItemStatus> {
    const found = presence ?? (await detectCustomItemPresence(env, item.checkCommand))
    const base = toItem(item)
    if (found !== 'found') {
      return { ...base, presence: found }
    }
    return {
      ...base,
      presence: 'found',
      installedBy: item.massorcaInstalledAt === undefined ? 'outside' : 'massorca'
    }
  }

  async function list(): Promise<MarketplaceCustomItemStatus[]> {
    const items = env.store.read()
    if (items === null) {
      throw new Error('The custom items file cannot be read.')
    }
    return Promise.all(items.map((item) => status(item)))
  }

  function insert(draft: CustomItemDraft): Change<StoredCustomItem> {
    const items = env.store.read()
    if (items === null) {
      return refuse('failed')
    }
    if (items.some((item) => item.kind === draft.kind && sameName(item.name, draft.name))) {
      return refuse('duplicate')
    }
    const id = env.newId()
    if (items.some((item) => item.id === id)) {
      return refuse('failed')
    }
    const item: StoredCustomItem = {
      id,
      kind: draft.kind,
      name: draft.name,
      checkCommand: draft.checkCommand,
      install: draft.install,
      ...(draft.skillUrl === undefined ? {} : { skillUrl: draft.skillUrl }),
      createdAt: env.now()
    }
    env.store.write([...items, item])
    return { ok: true, value: item }
  }

  async function add(args: unknown): Promise<MarketplaceCustomResult> {
    const draft = parseAddArgs(args)
    if (draft === null) {
      return refuse('invalid-input')
    }
    const change = await serialize(() => insert(draft))
    if (!change.ok) {
      return change
    }
    return { ok: true, item: await status(change.value) }
  }

  async function remove(args: unknown): Promise<MarketplaceCustomResult> {
    const id = parseIdArgs(args)
    if (id === null) {
      return refuse('invalid-input')
    }
    const change = await serialize((): Change<StoredCustomItem> => {
      const items = env.store.read()
      if (items === null) {
        return refuse('failed')
      }
      const removed = items.find((item) => item.id === id)
      if (removed === undefined) {
        return refuse('not-found')
      }
      env.store.write(items.filter((item) => item.id !== id))
      return { ok: true, value: removed }
    })
    if (!change.ok) {
      return change
    }
    // Why unverifiable: removal forgets the entry and checks nothing on the machine.
    return { ok: true, item: { ...toItem(change.value), presence: 'unverifiable' } }
  }

  function installArgvFor(item: StoredCustomItem): readonly string[] | null {
    const platform = marketplacePlatform(env.platform)
    if (item.kind === 'skill' || platform === null) {
      return null
    }
    return item.install[platform] ?? null
  }

  function recordInstall(id: string): Change<StoredCustomItem> {
    const items = env.store.read()
    if (items === null) {
      return refuse('failed')
    }
    const target = items.find((item) => item.id === id)
    if (target === undefined) {
      return refuse('not-found')
    }
    const recorded: StoredCustomItem = { ...target, massorcaInstalledAt: env.now() }
    env.store.write(items.map((item) => (item.id === id ? recorded : item)))
    return { ok: true, value: recorded }
  }

  async function runInstall(
    item: StoredCustomItem,
    argv: readonly string[],
    onEvent: (event: MarketplaceCustomInstallEvent) => void
  ): Promise<MarketplaceCustomResult> {
    const { id } = item
    const fail = (reason: Refusal['reason'], logLine: string): Refusal => {
      onEvent({ id, status: 'failed', logLine })
      return refuse(reason)
    }
    onEvent({ id, status: 'running' })
    const runnable = await resolveInstallArgv(env, argv)
    if (runnable === null) {
      return fail('failed', 'The install program was not found or could not run.')
    }
    let run: CustomInstallRun
    try {
      run = await env.runInstall(runnable, (logLine) => onEvent({ id, status: 'running', logLine }))
    } catch {
      return fail('failed', 'The install command could not be started.')
    }
    if (run.timedOut) {
      return fail('failed', 'The install command timed out.')
    }
    if (run.code !== 0) {
      return fail('failed', `The install command ended with code ${run.code ?? 'none'}.`)
    }
    const presence = await detectCustomItemPresence(env, item.checkCommand)
    if (presence !== 'found') {
      return fail(
        'failed',
        presence === 'missing'
          ? 'The check command still does not find it.'
          : 'The check command could not confirm the install.'
      )
    }
    const recorded = await serialize(() => recordInstall(id))
    if (!recorded.ok) {
      return fail(
        recorded.reason,
        'The install finished, but the custom item could not be updated.'
      )
    }
    onEvent({ id, status: 'done' })
    return { ok: true, item: await status(recorded.value, 'found') }
  }

  async function install(
    args: unknown,
    onEvent: (event: MarketplaceCustomInstallEvent) => void
  ): Promise<MarketplaceCustomResult> {
    const id = parseIdArgs(args)
    if (id === null) {
      return refuse('invalid-input')
    }
    const items = env.store.read()
    if (items === null) {
      return refuse('failed')
    }
    const item = items.find((candidate) => candidate.id === id)
    if (item === undefined) {
      return refuse('not-found')
    }
    const argv = installArgvFor(item)
    if (argv === null) {
      return refuse('unsupported-platform')
    }
    // Why: a second run of the same item would install twice at once.
    if (installing.has(id)) {
      return refuse('failed')
    }
    installing.add(id)
    try {
      return await runInstall(item, argv, onEvent)
    } finally {
      installing.delete(id)
    }
  }

  return { list, add, remove, install }
}
