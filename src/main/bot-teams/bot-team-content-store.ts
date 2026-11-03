import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, open, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * Each file is kept once, under the sha256 of its bytes, so a file that versions still hold takes
 * no new space. Writes land in a temporary file and are renamed into place: a crash leaves no
 * partial object, and a version written last never points at a missing one.
 */

const OBJECTS_DIR = 'objects'
export const TEMP_DIR = 'tmp'
export const VERSIONS_DIR = 'versions'

/** A file grew past the size limit while it was being read. */
export class FileOverLimitError extends Error {
  constructor(file: string) {
    super(`File is over the size limit: ${file}`)
  }
}

export function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

export async function ensureStoreDirectories(storeDir: string): Promise<void> {
  await Promise.all(
    [OBJECTS_DIR, TEMP_DIR, VERSIONS_DIR].map((name) =>
      mkdir(path.join(storeDir, name), { recursive: true })
    )
  )
}

export function objectPath(storeDir: string, hash: string): string {
  return path.join(storeDir, OBJECTS_DIR, hash.slice(0, 2), hash)
}

export function tempPath(storeDir: string): string {
  return path.join(storeDir, TEMP_DIR, randomUUID())
}

export async function hasObject(storeDir: string, hash: string): Promise<boolean> {
  return access(objectPath(storeDir, hash)).then(
    () => true,
    () => false
  )
}

/** The sha256 and size of a file, read in chunks; nothing is kept but the digest. */
export async function hashFile(
  file: string,
  maxBytes: number
): Promise<{ hash: string; size: number }> {
  const hash = createHash('sha256')
  let size = 0
  await pipeline(
    createReadStream(file),
    new Writable({
      write(chunk: Buffer, _encoding, callback) {
        size += chunk.length
        if (size > maxBytes) {
          callback(new FileOverLimitError(file))
          return
        }
        hash.update(chunk)
        callback()
      }
    })
  )
  return { hash: hash.digest('hex'), size }
}

/** Copies a file into the store under the hash of the bytes it actually copied. */
export async function storeFile(
  storeDir: string,
  file: string,
  maxBytes: number
): Promise<{ hash: string; size: number }> {
  const temp = tempPath(storeDir)
  const hash = createHash('sha256')
  let size = 0
  try {
    await pipeline(
      createReadStream(file),
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          size += chunk.length
          if (size > maxBytes) {
            callback(new FileOverLimitError(file))
            return
          }
          hash.update(chunk)
          callback(null, chunk)
        }
      }),
      createWriteStream(temp)
    )
    const digest = hash.digest('hex')
    await publish(temp, objectPath(storeDir, digest))
    return { hash: digest, size }
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

async function publish(temp: string, target: string): Promise<void> {
  if (
    await access(target).then(
      () => true,
      () => false
    )
  ) {
    // Same hash means same bytes, so the object already held is kept.
    await rm(temp, { force: true })
    return
  }
  await mkdir(path.dirname(target), { recursive: true })
  await rename(temp, target)
}

/** Writes a stored file to `destination`, replacing what is there, through a temporary file. */
export async function copyObjectTo(
  storeDir: string,
  hash: string,
  destination: string
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true })
  const temp = `${destination}.${randomUUID()}.massorca-tmp`
  try {
    await pipeline(createReadStream(objectPath(storeDir, hash)), createWriteStream(temp))
    await rename(temp, destination)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

/** The first bytes of a stored file, enough to tell whether it is binary. */
export async function readObjectHead(
  storeDir: string,
  hash: string,
  length: number
): Promise<Buffer> {
  const handle = await open(objectPath(storeDir, hash), 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
