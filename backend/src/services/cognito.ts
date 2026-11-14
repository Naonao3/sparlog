import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import { env } from '../config/env.js'

/**
 * Cognito の管理 API。認証情報は SDK の既定の解決順（ECS ではタスクロール）を使う。
 * ユーザープールのリージョンはプールIDの接頭辞から決まる。
 */
const client = new CognitoIdentityProviderClient({
  region: env.COGNITO_USER_POOL_ID.split('_')[0],
})

/**
 * Cognito のユーザーを削除する。既に存在しなければ成功扱いにする。
 * username は ID トークンの `cognito:username`（Google ユーザーは sub ではなく `google_xxx`）。
 */
export async function deleteUser(username: string): Promise<void> {
  try {
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: env.COGNITO_USER_POOL_ID,
        Username: username,
      }),
    )
  } catch (error: unknown) {
    if (error instanceof UserNotFoundException) return
    throw error
  }
}
