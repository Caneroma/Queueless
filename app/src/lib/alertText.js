// Simple and clear alert wording for in-app banners and notifications.
export function alertText(kind, ticket) {
  if (kind === 'leave') {
    return {
      title: 'Time to head over',
      body: `${ticket.queueName}: About ${ticket.travelMin} min away.`,
    };
  }
  if (kind === 'next') {
    return {
      title: `You are next (#${ticket.number})`,
      body: `${ticket.queueName}: Get ready, you are called after the current number.`,
    };
  }
  return {
    title: `Your turn! (#${ticket.number})`,
    body: `${ticket.queueName}: Please go to the counter now.`,
  };
}

