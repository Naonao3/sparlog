import { Hono } from 'hono'
import * as tagService from '../services/tag.js'
import type { AppEnv } from '../types/index.js'

export const categoriesRoute = new Hono<AppEnv>()

categoriesRoute.get('/', async (c) => {
  const categories = await tagService.listCategories()
  return c.json({ items: categories })
})
