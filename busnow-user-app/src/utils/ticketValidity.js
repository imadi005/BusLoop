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

export function withTicketValidity(ticket, now = Date.now()) {
  const expiry = getTicketExpiry(ticket?.booked_at);
  const timeExpired = isTicketTimeExpired(ticket, now);
  return {
    ...ticket,
    raw_status: ticket?.status,
    status: timeExpired ? 'expired' : ticket?.status,
    expires_at: expiry?.toISOString() || null,
    time_expired: timeExpired,
  };
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

export function formatTicketBoardedAt(iso) {
  if (!iso) return 'Boarding time not recorded';
  return `Boarded at ${new Date(iso).toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })}`;
}

export function formatTicketTimeLeft(iso, now = Date.now()) {
  if (!iso) return 'Board within 2 hours';
  const remainingMs = new Date(iso).getTime() - now;
  if (remainingMs <= 0) return 'Expired';
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min left`;
  if (minutes === 0) return `${hours} hr left`;
  return `${hours} hr ${minutes} min left`;
}
