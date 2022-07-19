const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  liveId: String,
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel'},
  UserCount: {
    type: Number, default: 0
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('LiveId', Schema)