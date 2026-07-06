export const TICKET_VALIDITY_HOURS = 2;
export const TICKET_VALIDITY_MS = TICKET_VALIDITY_HOURS * 60 * 60 * 1000;

export function getTicketExpiry(bookedAt) {
  if (!bookedAt) return null;
  const bookedTime = new Date(bookedAt).getTime();
  if (Number.isNaN(bookedTime)) return null;
  return new Date(bookedTime + TICKET_VALIDITY_MS);
}

export function isTicketTimeExpired(ticket, now = Date.now()) {
  if (!ticket || ticket.status !== 'active') return false;
  const expiry = getTicketExpiry(ticket.booked_at);
  return expiry ? expiry.getTime() <= now : false;
}

export function formatTicketExpiry(iso) {
  if (!iso) return 'Expires 2 hours after booking';
  return `Valid until ${new Date(iso).toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })}`;
}
