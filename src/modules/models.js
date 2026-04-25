import { MongoClient } from 'lumora/services'
import userSchema from './users/schema.js'
import userEventSchema from './users/userEvents/schema.js'

const MONGO_CLIENT_NAME = 'default'

const registerModels = () => {
  MongoClient.registerModel(MONGO_CLIENT_NAME, 'User', userSchema)
  MongoClient.registerModel(MONGO_CLIENT_NAME, 'UserEvent', userEventSchema)
}

export default registerModels
