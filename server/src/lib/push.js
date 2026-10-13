const Ticket = require('../models/Ticket');

// Sends a best-effort Expo push notification. Push is deliberately isolated from
// queue mutations: a notification outage must never stop the line moving.
async function send(ticket, { title, body }) {
  const pushUrl = process.env.EXPO_PUSH_URL;
  if (!pushUrl || !ticket || !ticket.expoPushToken) return;

  try {
    const response = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ticket.expoPushToken,
        sound: 'default',
        priority: 'high',
        channelId: 'called', // the loud channel the app creates; unknown ids fall back to default
        title,
        body,
        data: { ticketId: ticket.id },
      }),
    });
    if (!response.ok) console.error('Push notification failed:', response.status);
  } catch (error) {
    console.error('Push notification failed:', error.message);
  }
}

const notifyTicketCalled = (ticket, queueName) =>
  send(ticket, {
    title: 'It is your turn',
    body: `Number ${ticket.number} at ${queueName}. Go to the counter now.`,
  });

const notifyTicketNext = (ticket, queueName) =>
  send(ticket, {
    title: 'You are next',
    body: `Number ${ticket.number} at ${queueName}. Be ready to go to the counter.`,
  });

// `waiting` is the line in order. Every phone ticket directly before or after a paper token is
// asked, once per token, to tell that person when they are called. The $addToSet filter makes
// "ask once" atomic, so two quick updates cannot send two requests.
async function notifyNeighbours(queue, waiting) {
  try {
    for (let i = 0; i < waiting.length; i += 1) {
      const token = waiting[i];
      if (token.kind !== 'physical') continue;
      const sides = [
        [waiting[i - 1], 'after'], // the token sits right after the person before it
        [waiting[i + 1], 'before'],
      ];
      for (const [neighbour, side] of sides) {
        if (!neighbour || neighbour.kind !== 'digital') continue;
        const asked = await Ticket.updateOne(
          { _id: neighbour._id, relayed: { $ne: token.number } },
          { $addToSet: { relayed: token.number } }
        );
        if (!asked.modifiedCount) continue;
        send(neighbour, {
          title: 'A walk-in is next to you',
          body:
            `Paper token ${token.number} at ${queue.name} is right ${side} you and has no phone. ` +
            'There is no receptionist, so please tell them when they are called.',
        });
      }
    }
  } catch (error) {
    console.error('Neighbour request failed:', error.message);
  }
}

module.exports = { notifyTicketCalled, notifyTicketNext, notifyNeighbours };
