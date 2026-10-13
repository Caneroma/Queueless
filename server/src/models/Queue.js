const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  // Proves ownership in place of a login. Never include it in a public response.
  ownerKey: { type: String, required: true },
  status: { type: String, enum: ['open', 'paused', 'closed'], default: 'open' },
  defaultServiceMin: { type: Number, default: 5 },
  // True when nobody is at the counter to call out paper tokens: people waiting beside a
  // walk-in are asked to pass the word on.
  noReceptionist: { type: Boolean, default: false },
  // Counter for token numbers; only ever changed with an atomic $inc.
  lastNumber: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  closedAt: Date,
});

module.exports = mongoose.model('Queue', queueSchema);
