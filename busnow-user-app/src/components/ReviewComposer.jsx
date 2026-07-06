import { useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';

const QUICK_TAGS = [
  'On time',
  'Clean bus',
  'Safe driving',
  'Helpful staff',
  'Comfortable ride',
  'Easy ticketing',
  'Too crowded',
  'Late arrival',
  'Rough driving',
  'Needs cleaning',
];

export default function ReviewComposer({ journey, onSubmit, onCancel, submitting = false }) {
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const dateLabel = useMemo(() => {
    const raw = journey?.booked_at || journey?.created_at;
    if (!raw) return 'Past journey';
    return new Date(raw).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }, [journey]);

  const toggleTag = (tag) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const handleSubmit = () => {
    const cleanNote = note.trim();
    if (selectedTags.length === 0 && !cleanNote) {
      setError('Pick at least one quick option or add a short note.');
      return;
    }

    const comment = [...selectedTags, cleanNote].filter(Boolean).join(' - ');
    if (comment.length > 500) {
      setError('Please keep the review under 500 characters.');
      return;
    }

    setError('');
    onSubmit({ rating, comment });
  };

  return (
    <div className="review-composer">
      <div className="review-composer__top">
        <div>
          <h2>Rate Journey</h2>
          <p>{journey?.route_name || 'Your completed bus trip'}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close review form">
          <X size={18} />
        </button>
      </div>

      <div className="review-composer__journey">
        <div>
          <span>Bus</span>
          <strong>{journey?.bus_name || journey?.name || 'Bus'}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>{dateLabel}</strong>
        </div>
      </div>

      <div className="review-composer__stars" aria-label="Choose rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={`review-composer__star ${value <= rating ? 'is-active' : ''}`}
            onClick={() => setRating(value)}
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
          >
            <Star size={30} fill={value <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>

      <div className="review-composer__chips">
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`review-chip ${selectedTags.includes(tag) ? 'is-selected' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <textarea
        className="form-input review-composer__note"
        rows={3}
        value={note}
        maxLength={260}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Anything else to add?"
      />

      {error && <div className="form-error">{error}</div>}

      <div className="review-composer__footer">
        <button type="button" className="btn btn--primary btn--full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
}
