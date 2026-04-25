import userEventEndpoints from './users/userEvents/routes/index.js'
import userEndpoints from './users/routes/index.js'

const endpoints = [
  ...userEventEndpoints,
  ...userEndpoints,
]

export default endpoints
