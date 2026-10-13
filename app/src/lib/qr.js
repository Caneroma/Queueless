// What the QR codes carry. The prefix lets the scanner tell ours from any other QR, and tell a
// queue (join it) from a single ticket (link it to this phone).
const QUEUE = 'QUEUELESS:';
const TICKET = 'QUEUELESS-TICKET:';

export const queueQr = (code) => `${QUEUE}${code}`;
export const ticketQr = (ticketId) => `${TICKET}${ticketId}`;

// Returns { kind: 'queue' | 'ticket', value } for one of ours, or null for anything else.
export function parseQr(data) {
  if (data.startsWith(TICKET)) return { kind: 'ticket', value: data.slice(TICKET.length) };
  if (data.startsWith(QUEUE)) return { kind: 'queue', value: data.slice(QUEUE.length) };
  return null;
}
