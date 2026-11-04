import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// v2 file: MAGIC | updatedAt (u64 BE ms) | iv (12) | auth tag (16) | ciphertext.
const MAGIC = Buffer.from('MVT2')
const UPDATED_AT_BYTES = 8
const IV_BYTES = 12
const TAG_BYTES = 16
const HEADER_BYTES = MAGIC.length + UPDATED_AT_BYTES
export const VAULT_KEY_BYTES = 32

export function isSealedV2(blob: Buffer): boolean {
  return (
    blob.length >= HEADER_BYTES + IV_BYTES + TAG_BYTES &&
    blob.subarray(0, MAGIC.length).equals(MAGIC)
  )
}

/** When the secret was last set; it sits in the clear in the header but is authenticated with the rest. */
export function sealedUpdatedAt(blob: Buffer): number | null {
  if (!isSealedV2(blob)) {
    return null
  }
  const value = Number(blob.readBigUInt64BE(MAGIC.length))
  return Number.isSafeInteger(value) ? value : null
}

function additionalData(slotName: string, header: Buffer): Buffer {
  // Why: binding the file name stops a sealed file from being copied over another slot's.
  return Buffer.concat([Buffer.from(slotName, 'utf8'), header])
}

/** AES-256-GCM with a fresh random IV on every write. */
export function sealSecret(
  key: Buffer,
  slotName: string,
  plain: string,
  updatedAt: number
): Buffer {
  const header = Buffer.alloc(HEADER_BYTES)
  MAGIC.copy(header)
  header.writeBigUInt64BE(BigInt(updatedAt), MAGIC.length)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(additionalData(slotName, header))
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([header, iv, cipher.getAuthTag(), ciphertext])
}

/** Null for anything that is not an untampered v2 file sealed with this key for this slot. */
export function openSecret(key: Buffer, slotName: string, blob: Buffer): string | null {
  if (!isSealedV2(blob)) {
    return null
  }
  try {
    const header = blob.subarray(0, HEADER_BYTES)
    const iv = blob.subarray(HEADER_BYTES, HEADER_BYTES + IV_BYTES)
    const tag = blob.subarray(HEADER_BYTES + IV_BYTES, HEADER_BYTES + IV_BYTES + TAG_BYTES)
    const ciphertext = blob.subarray(HEADER_BYTES + IV_BYTES + TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(additionalData(slotName, header))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
