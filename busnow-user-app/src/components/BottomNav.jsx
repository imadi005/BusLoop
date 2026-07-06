import { MapPin, Star, QrCode, Ticket, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { id: 'home',    label: 'Home',    icon: MapPin,   path: '/' },
  { id: 'reviews', label: 'Reviews', icon: Star,     path: '/reviews' },
  { id: 'qr',      label: '',        icon: QrCode,   path: '/qr',     isCenter: true },
  { id: 'tickets', label: 'Tickets', icon: Ticket,   path: '/tickets' },
  { id: 'profile', label: 'Profile', icon: User,     path: '/profile' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ id, label, icon: Icon, path, isCenter }) => {
        const isActive = location.pathname === path;
        if (isCenter) {
          return (
            <button
              key={id}
              className="bottom-nav__item"
              onClick={() => navigate(path)}
              aria-label="Scan Bus QR"
            >
              <div className="bottom-nav__qr">
                <Icon size={24} />
              </div>
            </button>
          );
        }
        return (
          <button
            key={id}
            className={`bottom-nav__item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
            <span className="bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
