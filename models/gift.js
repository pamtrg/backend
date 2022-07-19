const mongoose = require('mongoose')
let Schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
}, {
  timestamps: true
})

module.exports = mongoose.model('Gift', Schema)