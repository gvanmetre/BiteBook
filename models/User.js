/* User.js */

const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  createdAt: { type: Date },
  admin:    { type: Boolean, default: false },
  avatar: { type: String },
  verificationToken: { type: String },
  expires: { type: Date },
  isVerified: { type: Boolean, default: false },
  suspendedUntil: { type: Date, default: null },
  recipes: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }
  ]
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);