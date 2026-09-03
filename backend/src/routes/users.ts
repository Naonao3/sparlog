import { Hono } from 'hono'
import { validate } from '../middleware/validate.js'
import * as userService from '../services/user.js'
import { updateUserSchema, type AppEnv } from '../types/index.js'

export const usersRoute = new Hono<AppEnv>()

usersRoute.get('/me', async (c) => {
  const profile = await userService.getProfile(c.get('userId'), c.get('userEmail'))
  return c.json(profile)
})

usersRoute.patch('/me', validate('json', updateUserSchema), async (c) => {
  const profile = await userService.updateProfile(c.get('userId'), c.req.valid('json'))
  return c.json(profile)
})

usersRoute.delete('/me', async (c) => {
  await userService.deleteAccount(c.get('userId'))
  return c.body(null, 204)
})
