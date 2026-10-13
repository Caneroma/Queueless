const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', required: true, index: true },
  number: { type: Number, required: true },
  // Orders the line. Equals `number` until a recall moves someone to the back.
  sortKey: { type: Number, required: true },
  name: { type: String, default: '' },
  // 'digital' is a ticket on a phone (scanned, or claimed from a walk-in's QR); 'physical' is a
  // paper token added by the receptionist.
  kind: { type: String, enum: ['digital', 'physical'], default: 'digital' },
  // Physical tokens a neighbour has already been asked to pass on, so each is asked only once.
  relayed: { type: [Number], default: [] },
  // Device token used by the server to notify a customer when this ticket is called.
  expoPushToken: { type: String, default: '' },
  status: {
    type: String,
    enum: ['waiting', 'serving', 'done', 'skipped', 'left'],
    default: 'waiting',
  },
  joinedAt: { type: Date, default: Date.now },
  // calledAt -> finishedAt is the real service time used for the estimate.
  calledAt: Date,
  finishedAt: Date,
});

module.exports = mongoose.model('Ticket', ticketSchema);
