import { Hono } from 'hono'
import { validate } from '../middleware/validate.js'
import * as commentService from '../services/comment.js'
import {
  createCommentSchema,
  idParamSchema,
  updateCommentSchema,
  videoCommentParamSchema,
  type AppEnv,
} from '../types/index.js'

/** /videos 配下にマウントする（/videos/:id/comments） */
export const commentsRoute = new Hono<AppEnv>()

commentsRoute.get('/:id/comments', validate('param', idParamSchema), async (c) => {
  const comments = await commentService.listComments(c.get('userId'), c.req.valid('param').id)
  return c.json({ items: comments })
})

commentsRoute.post(
  '/:id/comments',
  validate('param', idParamSchema),
  validate('json', createCommentSchema),
  async (c) => {
    const comment = await commentService.createComment(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    )
    return c.json(comment, 201)
  },
)

commentsRoute.patch(
  '/:id/comments/:cid',
  validate('param', videoCommentParamSchema),
  validate('json', updateCommentSchema),
  async (c) => {
    const { id, cid } = c.req.valid('param')
    const comment = await commentService.updateComment(
      c.get('userId'),
      id,
      cid,
      c.req.valid('json'),
    )
    return c.json(comment)
  },
)

commentsRoute.delete(
  '/:id/comments/:cid',
  validate('param', videoCommentParamSchema),
  async (c) => {
    const { id, cid } = c.req.valid('param')
    await commentService.deleteComment(c.get('userId'), id, cid)
    return c.body(null, 204)
  },
)
