import { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Star, TicketCheck } from 'lucide-react';
import { reviewService, ticketService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import ReviewComposer from '../components/ReviewComposer';
import { formatTicketBoardedAt } from '../utils/ticketValidity';

function StarDisplay({ rating }) {
  return (
    <span className="review-stars-display">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={14} fill={value <= rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [pastJourneys, setPastJourneys] = useState([]);
  const [reviewJourney, setReviewJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadData(); }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, tData] = await Promise.allSettled([
        reviewService.getAll(),
        user ? ticketService.getMyTickets(user.id) : Promise.resolve([]),
      ]);
      setReviews(rData.status === 'fulfilled' ? (rData.value || []) : []);
      const tickets = tData.status === 'fulfilled' ? (tData.value || []) : [];
      setPastJourneys(tickets.filter(t => t.status === 'used' && (t.bus_id || t.trips?.bus_id)));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async ({ rating, comment }) => {
    if (!reviewJourney?.bus_id || !user) return;
    setSubmitting(true);
    try {
      await reviewService.insert({
        passengerId: user.id,
        busId: reviewJourney.bus_id,
        tripId: reviewJourney.trip_id || reviewJourney.trips?.id,
        rating,
        comment,
      });
      setReviewJourney(null);
      showToast('Review submitted! Thank you.');
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Review could not be submitted.', false);
    } finally {
      setSubmitting(false);
    }
  };

  const myReviews = reviews.filter(r => r.passenger_id === user?.id);
  const reviewedTripIds = new Set(myReviews.filter(r => r.trip_id).map(r => r.trip_id));
  const reviewedBusIds = new Set(myReviews.filter(r => !r.trip_id).map(r => r.bus_id));
  const pendingJourneys = pastJourneys.filter(ticket => {
    if (ticket.trip_id) return !reviewedTripIds.has(ticket.trip_id);
    return !reviewedBusIds.has(ticket.bus_id);
  });
  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {toast && (
        <div className={`toast ${toast.ok ? 'toast--ok' : 'toast--error'}`}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '18px 16px 96px' }}>
        <div className="card" style={{
          padding: 18,
          borderRadius: 24,
          borderColor: 'rgba(239,62,66,0.18)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7F7 100%)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              background: 'var(--brand)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-brand)',
              flexShrink: 0,
            }}>
              <Star size={28} fill="currentColor" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: 2 }}>Reviews</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Rate completed journeys and see passenger feedback.
              </p>
            </div>
            <button
              onClick={loadData}
              className="btn btn--secondary btn--sm"
              style={{ borderRadius: 999 }}
              disabled={loading}
            >
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
            {[
              { label: 'To Rate', value: loading ? '-' : pendingJourneys.length },
              { label: 'My Reviews', value: loading ? '-' : myReviews.length },
              { label: 'Avg', value: loading ? '-' : averageRating },
            ].map((item) => (
              <div key={item.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.12rem', fontWeight: 900, color: 'var(--text-primary)' }}>{item.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="journey-review-section" style={{ marginBottom: 18 }}>
          <div className="section-title-row">
            <div>
              <h2>Past Journeys</h2>
              <p>Completed trips ready for feedback</p>
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 36 }}>
              <RefreshCw size={26} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : pastJourneys.length === 0 ? (
            <div className="empty-state card" style={{ padding: '34px 18px' }}>
              <TicketCheck size={38} color="var(--text-muted)" />
              <h3>No completed journeys</h3>
              <p>Used tickets will appear here after a checker verifies boarding.</p>
            </div>
          ) : (
            <div className="stack stack--sm">
              {pastJourneys.slice(0, 5).map((ticket) => {
                const reviewed = ticket.trip_id
                  ? reviewedTripIds.has(ticket.trip_id)
                  : reviewedBusIds.has(ticket.bus_id);
                const dateLabel = ticket.booked_at
                  ? new Date(ticket.booked_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                  : 'Past trip';
                return (
                  <div key={ticket.id} className="journey-review-card">
                    <div className="journey-review-card__main">
                      <strong>{ticket.bus_name || 'Bus'}</strong>
                      <span>{ticket.route_name || 'Unknown route'}</span>
                      <small>{ticket.used_at ? formatTicketBoardedAt(ticket.used_at) : dateLabel}</small>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--sm ${reviewed ? 'btn--secondary' : 'btn--ghost'}`}
                      onClick={() => !reviewed && setReviewJourney(ticket)}
                      disabled={reviewed}
                    >
                      {reviewed ? 'Reviewed' : 'Rate'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && (
          <div className="journey-review-section" style={{ marginBottom: 18 }}>
            <div className="section-title-row">
              <div>
                <h2>Recent Reviews</h2>
                <p>What passengers are saying</p>
              </div>
            </div>
            {reviews.length === 0 ? (
              <div className="empty-state card" style={{ padding: '34px 18px' }}>
                <MessageSquare size={38} color="var(--text-muted)" />
                <h3>No reviews yet</h3>
                <p>Reviews will appear here after passengers rate trips.</p>
              </div>
            ) : (
              <div className="stack stack--sm">
                {reviews.map(r => (
                  <div key={r.id} className="review-card">
                    <div className="review-card__header">
                      <div className="review-card__avatar">{(r.passenger || r.users?.full_name || 'A')[0].toUpperCase()}</div>
                      <div className="review-card__info">
                        <div className="review-card__name">{r.passenger || r.users?.full_name || 'Anonymous'}</div>
                        <div className="review-card__bus">{r.bus_name || r.buses?.name || 'Bus'}</div>
                        <div className="review-card__rating-row">
                          <StarDisplay rating={r.rating} />
                          <span className="review-card__date">{timeAgo(r.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="review-card__comment">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {reviewJourney && (
        <div className="modal-overlay" onClick={() => setReviewJourney(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <ReviewComposer
              journey={reviewJourney}
              onSubmit={handleSubmit}
              onCancel={() => setReviewJourney(null)}
              submitting={submitting}
            />
          </div>
        </div>
      )}

      <BottomNav />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
