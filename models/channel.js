const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  username: String,
  liveChatCount: {
    type: Number, default: 0
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Channel', Schema)