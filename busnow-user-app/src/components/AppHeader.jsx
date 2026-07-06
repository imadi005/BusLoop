import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AppHeader({ title, showBack = false, action }) {
  const navigate = useNavigate();
  return (
    <header className="app-header">
      {showBack && (
        <button
          className="app-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      {!showBack && (
        <span className="app-brand">
          <img src="/busloop-mark.png" alt="" className="app-brand__mark" />
          <span className="logo-text">BusLoop</span>
        </span>
      )}
      <h1 className="app-header__title" style={showBack ? {} : { fontSize: '1rem', opacity: 0.7 }}>
        {title}
      </h1>
      {action && action}
    </header>
  );
}
