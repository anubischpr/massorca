import { describe, expect, it } from 'vitest'
import {
  decodeAntigravityKeychainValue,
  encodeAntigravityKeychainValue,
  parseAntigravityNativeCredential
} from './native-credential-codec'

function credential(claims: Record<string, unknown> = {}): string {
  return JSON.stringify({
    token: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' },
    auth_method: 'consumer',
    id_token: `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic`,
    future_field: { preserved: true }
  })
}

describe('native Antigravity credential format', () => {
  it('reads the installed macOS go-keyring wrapper and preserves the entire native blob', () => {
    const contents = credential({
      iss: 'https://accounts.google.com',
      sub: 'synthetic-subject',
      email: 'test@example.invalid',
      email_verified: true
    })
    const decoded = decodeAntigravityKeychainValue(
      `  ${encodeAntigravityKeychainValue(contents)}\n`
    )
    expect(parseAntigravityNativeCredential(decoded)).toEqual({
      contents,
      authMethod: 'consumer',
      identity: {
        issuer: 'https://accounts.google.com',
        subject: 'synthetic-subject',
        email: 'test@example.invalid'
      }
    })
  })

  it('accepts older hex wrappers, plain JSON, and UTF-8 account labels', () => {
    const contents = credential({ name: 'テスト' })
    const hex = `go-keyring-encoded:${Buffer.from(contents).toString('hex').toUpperCase()}`
    expect(decodeAntigravityKeychainValue(hex)).toBe(contents)
    expect(decodeAntigravityKeychainValue(contents)).toBe(contents)
    expect(decodeAntigravityKeychainValue(encodeAntigravityKeychainValue(contents))).toBe(contents)
  })

  it.each([
    'go-keyring-base64:',
    'go-keyring-base64:e30=secret',
    'go-keyring-base64:!!!!',
    'go-keyring-base64:/w==',
    'go-keyring-encoded:0',
    'go-keyring-encoded:zz',
    'go-keyring-encoded:ff',
    'x'.repeat(65537)
  ])('rejects corrupt keyring encodings without echoing their contents (%#)', (value) => {
    expect(() => decodeAntigravityKeychainValue(value)).toThrow(
      'Antigravity credentials could not be decoded.'
    )
  })

  it.each(['synthetic-secret', 'null', '[]', '{}', '{"token":{"access_token":""}}'])(
    'rejects malformed credential records with a fixed, secret-free error (%#)',
    (contents) => {
      expect(() => parseAntigravityNativeCredential(contents)).toThrow(
        'Antigravity credentials could not be decoded.'
      )
    }
  )

  it('does not borrow identity when native claims are missing or from another issuer', () => {
    expect(parseAntigravityNativeCredential(credential()).identity).toBeNull()
    expect(
      parseAntigravityNativeCredential(credential({ iss: 'other', sub: 'same' })).identity
    ).toBeNull()
  })

  it('does not present an unverified email as the signed-in account', () => {
    expect(
      parseAntigravityNativeCredential(
        credential({ iss: 'accounts.google.com', sub: 'synthetic', email: 'test@example.invalid' })
      ).identity
    ).toEqual({ issuer: 'https://accounts.google.com', subject: 'synthetic', email: null })
  })

  it('retains credentials without an ID token, expiry or refresh token', () => {
    const contents = '{ "auth_method": "future", "token": { "access_token": "synthetic" } }'
    expect(parseAntigravityNativeCredential(contents)).toEqual({
      contents,
      authMethod: 'future',
      identity: null
    })
  })
})

describe('Antigravity credentials without an id_token', () => {
  function emailCredential(idTokenEmail: unknown): string {
    return JSON.stringify({
      auth_method: 'consumer',
      id_token_email: idTokenEmail,
      token: {
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        token_type: 'Bearer'
      }
    })
  }

  it('derives a namespaced, lowercased identity from a plain id_token_email', () => {
    expect(
      parseAntigravityNativeCredential(emailCredential('  Test.User@Example.Invalid \n')).identity
    ).toEqual({
      issuer: 'https://accounts.google.com',
      subject: 'email:test.user@example.invalid',
      email: 'test.user@example.invalid'
    })
  })

  it('parses a JWT id_token_email like an id_token', () => {
    const claims = {
      iss: 'https://accounts.google.com',
      sub: 'synthetic-subject',
      email: 'test@example.invalid',
      email_verified: true
    }
    const jwt = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic`
    expect(parseAntigravityNativeCredential(emailCredential(jwt)).identity).toEqual({
      issuer: 'https://accounts.google.com',
      subject: 'synthetic-subject',
      email: 'test@example.invalid'
    })
  })

  it('keeps the id_token authoritative when both shapes are present', () => {
    const claims = { iss: 'accounts.google.com', sub: 'jwt-subject' }
    const idToken = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic`
    const contents = JSON.stringify({
      auth_method: 'consumer',
      id_token: idToken,
      id_token_email: 'other@example.invalid',
      token: { access_token: 'synthetic-access' }
    })
    expect(parseAntigravityNativeCredential(contents).identity?.subject).toBe('jwt-subject')
    // A bad id_token never falls through to the unsigned label.
    const broken = JSON.stringify({
      auth_method: 'consumer',
      id_token: 'not-a-jwt',
      id_token_email: 'other@example.invalid',
      token: { access_token: 'synthetic-access' }
    })
    expect(parseAntigravityNativeCredential(broken).identity).toBeNull()
  })

  it.each([
    undefined,
    null,
    42,
    '',
    '   ',
    'no-at-sign',
    '@example.invalid',
    'user@',
    'a@b@example.invalid',
    'us er@example.invalid',
    'user@example.invalid\n@x',
    'user@exa\u0000mple.invalid',
    `${'a'.repeat(320)}@example.invalid`,
    'e30.!!!.synthetic',
    'not.a.jwt'
  ])('treats an unusable id_token_email as no identity (%#)', (label) => {
    expect(parseAntigravityNativeCredential(emailCredential(label)).identity).toBeNull()
  })
})
