import { MongoClient } from 'lumora/services/index.js'
import userSchema from './users/schema.js'
import { MODEL as USER_MODEL } from './users/constants.js'
import userEventSchema from './users/userEvents/schema.js'
import { MODEL as USER_EVENT_MODEL } from './users/userEvents/constants.js'

const MONGO_CLIENT_NAME = 'default'

const registerModels = () => {
  MongoClient.registerModel(MONGO_CLIENT_NAME, USER_MODEL, userSchema)
  MongoClient.registerModel(MONGO_CLIENT_NAME, USER_EVENT_MODEL, userEventSchema)
}

export default registerModels
