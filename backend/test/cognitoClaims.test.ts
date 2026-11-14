import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCognitoIdToken } from '../src/lib/cognitoClaims.js'

const base = {
  token_use: 'id',
  sub: '0b5c3f0e-1111-2222-3333-444455556666',
  'cognito:username': '0b5c3f0e-1111-2222-3333-444455556666',
  email: 'User@Example.com',
  email_verified: true,
}

describe('parseCognitoIdToken', () => {
  it('メール＋パスワードのユーザーは authProvider=email、メールは小文字にする', () => {
    const result = parseCognitoIdToken(base)
    assert.deepEqual(result, {
      ok: true,
      identity: {
        userId: base.sub,
        username: base['cognito:username'],
        email: 'user@example.com',
        authProvider: 'email',
        name: null,
        picture: null,
      },
    })
  })

  it('Google ユーザーは identities から authProvider=google と name / picture を取り出す', () => {
    const result = parseCognitoIdToken({
      ...base,
      'cognito:username': 'google_1234567890',
      email_verified: 'true',
      name: '山田 太郎',
      picture: 'https://example.com/a.png',
      identities: [{ providerName: 'Google', providerType: 'Google', userId: '1234567890' }],
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.identity.authProvider, 'google')
    assert.equal(result.identity.username, 'google_1234567890')
    assert.equal(result.identity.name, '山田 太郎')
    assert.equal(result.identity.picture, 'https://example.com/a.png')
  })

  it('identities が JSON 文字列でも読める', () => {
    const result = parseCognitoIdToken({
      ...base,
      identities: JSON.stringify([{ providerName: 'Google' }]),
    })
    assert.equal(result.ok && result.identity.authProvider, 'google')
  })

  it('アクセストークンは受け付けない', () => {
    assert.equal(parseCognitoIdToken({ ...base, token_use: 'access' }).ok, false)
  })

  it('メールアドレス未確認は受け付けない', () => {
    assert.equal(parseCognitoIdToken({ ...base, email_verified: false }).ok, false)
  })

  it('必須クレームが欠けていたら受け付けない', () => {
    const { email: _email, ...withoutEmail } = base
    assert.equal(parseCognitoIdToken(withoutEmail).ok, false)
    assert.equal(parseCognitoIdToken(null).ok, false)
  })
})
