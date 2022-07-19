const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  userId: String,
  nickname: {type: String},
  uniqueId: String,
  image: String,
  commentCount: {
    type: Number, default: 0
  },
  liveId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveId'},
}, {
  timestamps: true
})

Schema.index({nickname: 'text'});
module.exports = mongoose.model('User', Schema)