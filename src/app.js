import Koa from 'koa'
import koaQs from 'koa-qs'
import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'

import { toInt } from 'radash'

import { disconnectMongo, disconnectMysqlClient, disconnectRedisClient, useCoreServices } from './framework/index.js'
import endpoints from './modules/routes.js'
import { useCors } from './framework/koa/cors.js'
import addRoutes from './framework/koa/router.js'
import registerModels from './modules/models.js'

const app = new Koa()
let router = new Router()

app.proxy = true
koaQs(app, 'extended', { arrayLimit: 100 })

registerModels()
router = addRoutes(router, endpoints, useCoreServices())

app
  .use(bodyParser({
    multipart: true,
    urlencoded: true
  }))
  .use(useCors({ credentials: true }))
  .use(router.routes())
  .use(router.allowedMethods())

const port = toInt(process.env.PORT, 4000)
const server = app.listen(port, () => {
  console.log(`Lumora app listening on port ${port}`)
})

const stopServer = (cb) => {
  process.on('SIGTERM', cb)
  process.on('SIGINT', cb)
}

stopServer(() => {
  server.close(async () => {
    console.log('Server closed')
    await disconnectRedisClient()
    await disconnectMysqlClient()
    await disconnectMongo()
    process.exit(0)
  })
})
