import { MongoClient } from 'lumora/services/index.js'
import userEventSchema from './users/userEvents/schema.js'
import { MODEL as USER_EVENT_MODEL } from './users/userEvents/constants.js'

const MONGO_CLIENT_NAME = 'default'

// Mongo models only; MySQL tables are created by each module's migrations/
const registerModels = () => {
  MongoClient.registerModel(MONGO_CLIENT_NAME, USER_EVENT_MODEL, userEventSchema)
}

export default registerModels
