// One wording for an alert, shared by the in-app banner and the system notification.
export function alertText(kind, ticket) {
  if (kind === 'leave') {
    return {
      title: 'Time to head back',
      body: `${ticket.queueName}. You are ${ticket.travelMin} min away, so leave now for number ${ticket.number}.`,
    };
  }
  if (kind === 'next') {
    return {
      title: 'You are next',
      body: `${ticket.queueName}. Number ${ticket.number} is called after the current one. Be ready.`,
    };
  }
  return {
    title: `Number ${ticket.number} is being called`,
    body: `${ticket.queueName}. Go to the counter now.`,
  };
}
