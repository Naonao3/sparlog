import assert from 'node:assert/strict'
import { generateKeyPairSync, webcrypto } from 'node:crypto'
import { before, describe, it } from 'node:test'
import { sign } from 'hono/jwt'

const POOL_ID = 'ap-northeast-1_TestPool1'
const CLIENT_ID = 'test-client-id'
const ISSUER = `https://cognito-idp.ap-northeast-1.amazonaws.com/${POOL_ID}`
const KID = 'test-kid'

// env.ts は import 時に検証するため、モジュールを読み込む前に設定する
const cloudFrontKey = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sparlog_test',
  COGNITO_USER_POOL_ID: POOL_ID,
  COGNITO_CLIENT_ID: CLIENT_ID,
  S3_BUCKET_NAME: 'test-bucket',
  CLOUDFRONT_DOMAIN: 'https://dexample.cloudfront.net/',
  CLOUDFRONT_KEY_PAIR_ID: 'KTESTKEYPAIR',
  CLOUDFRONT_PRIVATE_KEY: cloudFrontKey.privateKey.replaceAll('\n', '\\n'),
})

type VerifyToken = (token: string) => Promise<unknown>
type CreateDownloadUrl = (input: { key: string; expiresIn?: number }) => {
  url: string
  expiresIn: number
}

let verifyToken: VerifyToken
let createDownloadUrl: CreateDownloadUrl
let signingKey: webcrypto.CryptoKey
let otherSigningKey: webcrypto.CryptoKey

async function generateRsaKey(): Promise<webcrypto.CryptoKeyPair> {
  return await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
}

/** Cognito の ID トークンと同じ形のトークンを作る（header に kid を付ける） */
async function issueToken(
  overrides: Record<string, unknown> = {},
  key: webcrypto.CryptoKey = signingKey,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    {
      sub: '0b5c3f0e-1111-2222-3333-444455556666',
      'cognito:username': '0b5c3f0e-1111-2222-3333-444455556666',
      email: 'user@example.com',
      email_verified: true,
      token_use: 'id',
      aud: CLIENT_ID,
      iss: ISSUER,
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    key,
    'RS256',
  )
  // hono の sign は CryptoKey から kid を付けないため、ヘッダを差し替えて署名し直す
  const [, payload] = token.split('.')
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID })).toString(
    'base64url',
  )
  const signature = await webcrypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`
}

before(async () => {
  const pair = await generateRsaKey()
  signingKey = pair.privateKey
  otherSigningKey = (await generateRsaKey()).privateKey

  const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  const jwksUrl = `${ISSUER}/.well-known/jwks.json`

  globalThis.fetch = (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    assert.equal(url, jwksUrl)
    return Promise.resolve(
      Response.json({ keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
    )
  }

  const auth = (await import('../src/middleware/auth.js')) as { verifyToken: VerifyToken }
  verifyToken = auth.verifyToken
  const storage = (await import('../src/services/storage.js')) as {
    createDownloadUrl: CreateDownloadUrl
  }
  createDownloadUrl = storage.createDownloadUrl
})

describe('verifyToken（Cognito ID トークン）', () => {
  it('正しいトークンはペイロードを返す', async () => {
    const payload = await verifyToken(await issueToken())
    assert.equal((payload as Record<string, unknown>).email, 'user@example.com')
  })

  it('別のアプリクライアント向け（aud 違い）は 401', async () => {
    await assert.rejects(verifyToken(await issueToken({ aud: 'other-client' })), {
      name: 'AppError',
      status: 401,
    })
  })

  it('別のユーザープール（iss 違い）は 401', async () => {
    await assert.rejects(
      verifyToken(await issueToken({ iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/x' })),
      { name: 'AppError', status: 401 },
    )
  })

  it('期限切れは 401', async () => {
    const past = Math.floor(Date.now() / 1000) - 7200
    await assert.rejects(verifyToken(await issueToken({ iat: past, exp: past + 60 })), {
      name: 'AppError',
      status: 401,
    })
  })

  it('別の鍵で署名されたトークンは 401', async () => {
    await assert.rejects(verifyToken(await issueToken({}, otherSigningKey)), {
      name: 'AppError',
      status: 401,
    })
  })

  it('kid の無いトークンは 401', async () => {
    const token = await sign({ sub: 'x', exp: Math.floor(Date.now() / 1000) + 60 }, 'secret')
    await assert.rejects(verifyToken(token), { name: 'AppError', status: 401 })
  })
})

describe('createDownloadUrl（CloudFront 署名付き URL）', () => {
  it('CloudFront のドメインにキーをパスとして付け、署名パラメータを付与する', () => {
    const { url, expiresIn } = createDownloadUrl({ key: 'thumbnails/u/v/thumb.jpg', expiresIn: 60 })
    const parsed = new URL(url)
    assert.equal(expiresIn, 60)
    assert.equal(parsed.origin, 'https://dexample.cloudfront.net')
    assert.equal(parsed.pathname, '/thumbnails/u/v/thumb.jpg')
    assert.equal(parsed.searchParams.get('Key-Pair-Id'), 'KTESTKEYPAIR')
    assert.ok(parsed.searchParams.get('Signature'))
    const expires = Number(parsed.searchParams.get('Expires'))
    const now = Math.floor(Date.now() / 1000)
    assert.ok(expires > now && expires <= now + 61)
  })
})
