import { Hono } from 'hono'
import { validate } from '../middleware/validate.js'
import * as commentService from '../services/comment.js'
import {
  createTimestampCommentSchema,
  idParamSchema,
  updateTimestampCommentSchema,
  videoTimestampParamSchema,
  type AppEnv,
} from '../types/index.js'

/** /videos 配下にマウントする（/videos/:id/timestamp-comments） */
export const timestampCommentsRoute = new Hono<AppEnv>()

timestampCommentsRoute.get(
  '/:id/timestamp-comments',
  validate('param', idParamSchema),
  async (c) => {
    const comments = await commentService.listTimestampComments(
      c.get('userId'),
      c.req.valid('param').id,
    )
    return c.json({ items: comments })
  },
)

timestampCommentsRoute.post(
  '/:id/timestamp-comments',
  validate('param', idParamSchema),
  validate('json', createTimestampCommentSchema),
  async (c) => {
    const comment = await commentService.createTimestampComment(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    )
    return c.json(comment, 201)
  },
)

timestampCommentsRoute.patch(
  '/:id/timestamp-comments/:tid',
  validate('param', videoTimestampParamSchema),
  validate('json', updateTimestampCommentSchema),
  async (c) => {
    const { id, tid } = c.req.valid('param')
    const comment = await commentService.updateTimestampComment(
      c.get('userId'),
      id,
      tid,
      c.req.valid('json'),
    )
    return c.json(comment)
  },
)

timestampCommentsRoute.delete(
  '/:id/timestamp-comments/:tid',
  validate('param', videoTimestampParamSchema),
  async (c) => {
    const { id, tid } = c.req.valid('param')
    await commentService.deleteTimestampComment(c.get('userId'), id, tid)
    return c.body(null, 204)
  },
)
