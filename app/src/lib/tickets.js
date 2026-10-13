import { api } from './api';
import { cancelLeaveReminder, registerForPushNotifications } from './notify';
import { removeTicket } from './storage';

// Gives up a ticket: tells the server (so the owner never calls a ghost), then forgets it here.
// A network failure throws and keeps the ticket, so it is never dropped locally while still
// waiting on the server. The caller shows the message and the person can retry.
export async function leaveTicket(ticket) {
  try {
    await api(`/tickets/${ticket.ticketId}/leave`, { method: 'POST' });
  } catch (e) {
    // 404: the server forgot it. 409: it already ended or is being served. Either way there is
    // nothing left to leave on the server, only the local copy to remove.
    if (e.status !== 404 && e.status !== 409) throw e;
  }
  await cancelLeaveReminder(ticket.ticketId); // a ticket that is gone must not buzz later
  return removeTicket(ticket.ticketId);
}

// Hands the server this phone's notification token, so a call reaches it with the app closed.
// Best effort: without it the in-app alerts still work.
export async function registerPush(ticketId) {
  const token = await registerForPushNotifications();
  if (!token) return;
  await api(`/tickets/${ticketId}/notifications`, { method: 'POST', body: { token } }).catch(() => {});
}
