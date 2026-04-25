import mongoose from 'mongoose'

const userEventSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  action: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
})

export default userEventSchema
