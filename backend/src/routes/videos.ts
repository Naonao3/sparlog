import { Hono } from 'hono'
import { validate } from '../middleware/validate.js'
import * as videoService from '../services/video.js'
import {
  createVideoSchema,
  idParamSchema,
  listVideosQuerySchema,
  updateVideoSchema,
  updateVideoTagsSchema,
  type AppEnv,
} from '../types/index.js'

export const videosRoute = new Hono<AppEnv>()

videosRoute.get('/', validate('query', listVideosQuerySchema), async (c) => {
  const result = await videoService.listVideos(c.get('userId'), c.req.valid('query'))
  return c.json(result)
})

videosRoute.post('/', validate('json', createVideoSchema), async (c) => {
  const result = await videoService.createVideo(c.get('userId'), c.req.valid('json'))
  return c.json(result, 201)
})

videosRoute.get('/:id', validate('param', idParamSchema), async (c) => {
  const video = await videoService.getVideo(c.get('userId'), c.req.valid('param').id)
  return c.json(video)
})

videosRoute.patch(
  '/:id',
  validate('param', idParamSchema),
  validate('json', updateVideoSchema),
  async (c) => {
    const video = await videoService.updateVideo(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    )
    return c.json(video)
  },
)

videosRoute.delete('/:id', validate('param', idParamSchema), async (c) => {
  await videoService.deleteVideo(c.get('userId'), c.req.valid('param').id)
  return c.body(null, 204)
})

videosRoute.post('/:id/complete', validate('param', idParamSchema), async (c) => {
  const video = await videoService.completeUpload(c.get('userId'), c.req.valid('param').id)
  return c.json(video, 202)
})

videosRoute.get('/:id/stream', validate('param', idParamSchema), async (c) => {
  const stream = await videoService.getStreamUrl(c.get('userId'), c.req.valid('param').id)
  return c.json(stream)
})

videosRoute.put(
  '/:id/tags',
  validate('param', idParamSchema),
  validate('json', updateVideoTagsSchema),
  async (c) => {
    const video = await videoService.updateVideoTags(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json').tagIds,
    )
    return c.json(video)
  },
)
