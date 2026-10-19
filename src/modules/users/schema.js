import mongoose from 'mongoose'
import { STATUS, STATUS_ACTIVE } from './constants.js'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  status: { type: String, enum: STATUS, default: STATUS_ACTIVE },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
})

export default userSchema
