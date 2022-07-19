const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  comment: String,
  profilePictureUrl: String,
  followRole: Number,
  userBadges: Array,
  isModerator: Boolean,
  isNewGifter: Boolean,
  isSubscriber: Boolean,
  topGifterRank: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
}, {
  timestamps: true
})

module.exports = mongoose.model('Comment', Schema)