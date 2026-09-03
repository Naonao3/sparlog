import { Hono } from 'hono'
import { validate } from '../middleware/validate.js'
import * as tagService from '../services/tag.js'
import { createTagSchema, idParamSchema, updateTagSchema, type AppEnv } from '../types/index.js'

export const tagsRoute = new Hono<AppEnv>()

tagsRoute.get('/', async (c) => {
  const tags = await tagService.listTags(c.get('userId'))
  return c.json({ items: tags })
})

tagsRoute.post('/', validate('json', createTagSchema), async (c) => {
  const tag = await tagService.createTag(c.get('userId'), c.req.valid('json'))
  return c.json(tag, 201)
})

tagsRoute.patch(
  '/:id',
  validate('param', idParamSchema),
  validate('json', updateTagSchema),
  async (c) => {
    const tag = await tagService.updateTag(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    )
    return c.json(tag)
  },
)

tagsRoute.delete('/:id', validate('param', idParamSchema), async (c) => {
  await tagService.deleteTag(c.get('userId'), c.req.valid('param').id)
  return c.body(null, 204)
})
