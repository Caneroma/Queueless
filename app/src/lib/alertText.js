// Simple and clear alert wording for in-app banners and notifications.
export function alertText(kind, ticket) {
  if (kind === 'leave') {
    return {
      title: 'Time to head over',
      body: `${ticket.queueName}: About ${ticket.travelMin} min away.`,
    };
  }
  return {
    title: `Your turn! (#${ticket.number})`,
    body: `${ticket.queueName}: Please go to the counter now.`,
  };
}

