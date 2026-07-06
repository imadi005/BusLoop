import { useNavigate } from 'react-router-dom';
import { Bus, Clock, ChevronRight, MapPin } from 'lucide-react';

const STATUS = {
  active:      { label: 'Active',      cls: 'active' },
  delayed:     { label: 'Delayed',     cls: 'delayed' },
  inactive:    { label: 'Inactive',    cls: 'inactive' },
  maintenance: { label: 'Maintenance', cls: 'maintenance' },
  stopped:     { label: 'Stopped',     cls: 'inactive' },
};

export default function BusCard({ bus }) {
  const navigate = useNavigate();
  const s = STATUS[bus.status] || STATUS.inactive;
  const isActive = bus.status === 'active' || bus.status === 'delayed';
  const color = bus.route_color || 'var(--text-muted)';

  return (
    <article
      className="bus-card"
      onClick={() => navigate(`/bus/${bus.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/bus/${bus.id}`)}
      aria-label={`View details for ${bus.name}`}
    >
      {/* Icon */}
      <div className="bus-card__icon" style={{ background: `${color}18`, color }}>
        <Bus size={22} />
      </div>

      {/* Body */}
      <div className="bus-card__body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="bus-card__name">{bus.name}</div>
          <span className={`badge badge--${s.cls}`} style={{ flexShrink: 0, marginLeft: 6 }}>{s.label}</span>
        </div>

        {/* Route: origin → destination preferred, fallback route_name */}
        {bus.route_origin && bus.route_destination ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>
            <MapPin size={11} color={color} style={{ flexShrink: 0 }} />
            {bus.route_origin} → {bus.route_destination}
          </div>
        ) : (
          <div className="bus-card__route">{bus.route_name || 'No route'}</div>
        )}

        {/* Landmarks preview */}
        {bus.route_landmarks && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            📍 {bus.route_landmarks}
          </div>
        )}

        {/* Meta row */}
        <div className="bus-card__meta" style={{ marginTop: 6 }}>
          {bus.eta_minutes != null && (
            <span className="bus-card__eta">
              <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {bus.eta_minutes} min
            </span>
          )}
          {isActive && (
            <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
              Live
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} color="#CBD5E0" style={{ flexShrink: 0, alignSelf: 'center' }} />

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
      `}</style>
    </article>
  );
}
