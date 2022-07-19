const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  likeCount: Number,
  totalLikeCount: Number,
  
}, {
  timestamps: true
})

module.exports = mongoose.model('Like', Schema)