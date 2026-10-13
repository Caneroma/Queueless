const Ticket = require('../models/Ticket');
const { notifyNeighbours } = require('./push');

const MS_PER_MIN = 60000;

// Average of the last 10 real services. Skipped and abandoned tickets are
// excluded because they never took service time. With fewer than 3 samples
// the average is too noisy, so the owner's guess is used instead.
async function avgServiceMin(queue) {
  const recent = await Ticket.find({ queueId: queue._id, status: 'done' })
    .sort({ finishedAt: -1 })
    .limit(10);
  if (recent.length < 3) return queue.defaultServiceMin;
  const total = recent.reduce((sum, t) => sum + (t.finishedAt - t.calledAt), 0);
  return total / recent.length / MS_PER_MIN;
}

const loadLine = (queue) =>
  Promise.all([
    Ticket.findOne({ queueId: queue._id, status: 'serving' }),
    Ticket.find({ queueId: queue._id, status: 'waiting' }).sort({ sortKey: 1 }),
  ]);

// The one shared shape, sent over REST and the socket. Numbers only: names
// stay with the owner so one customer never sees another's name. `physical`
// lists which of those numbers are paper tokens, so a phone can tell when
// the person beside it has no phone of their own.
async function buildSnapshot(queue, line) {
  const [serving, waiting] = line || (await loadLine(queue));
  const inLine = serving ? [serving, ...waiting] : waiting;
  return {
    code: queue.code,
    name: queue.name,
    status: queue.status,
    noReceptionist: queue.noReceptionist,
    serving: serving ? serving.number : null,
    waiting: waiting.map((t) => t.number),
    physical: inLine.filter((t) => t.kind === 'physical').map((t) => t.number),
    avgServiceMin: Math.round((await avgServiceMin(queue)) * 100) / 100,
  };
}

// Build a fresh snapshot, push it to everyone in the queue's room, and hand it
// back so the route can reply with the same data. Anyone newly sitting beside a
// paper token is asked to pass the word on, when the shop has no receptionist.
async function publish(io, queue) {
  const line = await loadLine(queue);
  const snapshot = await buildSnapshot(queue, line);
  io.to(queue.code).emit('queue:update', snapshot);
  if (queue.noReceptionist) notifyNeighbours(queue, line[1]);
  return snapshot;
}

module.exports = { buildSnapshot, publish };
