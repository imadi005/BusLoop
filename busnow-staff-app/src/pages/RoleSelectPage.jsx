import { useNavigate } from 'react-router-dom';
import { Bus, Car, ChevronRight, ShieldCheck, TicketCheck } from 'lucide-react';
import { STAFF_ROLES } from '../data/mockData';

const ROLE_CONFIG = {
  operator: {
    color: 'var(--operator)',
    bg: 'var(--operator-bg)',
    icon: Bus,
    badge: 'Operator',
  },
  driver: {
    color: 'var(--driver)',
    bg: 'var(--driver-bg)',
    icon: Car,
    badge: 'Driver',
  },
  checker: {
    color: 'var(--checker)',
    bg: 'var(--checker-bg)',
    icon: TicketCheck,
    badge: 'Checker',
  },
};

export default function RoleSelectPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    sessionStorage.setItem('staff_role', role);
    navigate(`/login/${role}`);
  };

  return (
    <main className="role-select-page">
      <section className="role-select-hero">
        <div className="role-select-hero__icon role-select-hero__icon--brand">
          <img src="/busloop-mark.png" alt="BusLoop" />
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '5px 12px',
          marginBottom: 12,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <ShieldCheck size={14} color="var(--brand)" />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand)', letterSpacing: '0.08em' }}>
            BUSLOOP STAFF PORTAL
          </span>
        </div>
        <h1 style={{ marginBottom: 6, color: 'var(--text-primary)' }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>Choose your workspace to continue.</p>
      </section>

      <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(STAFF_ROLES).map(([roleKey, role]) => {
          const cfg = ROLE_CONFIG[roleKey];
          const Icon = cfg.icon;

          return (
            <button
              key={roleKey}
              id={`role-${roleKey}`}
              className="role-card"
              aria-label={`Select ${role.label}`}
              onClick={() => handleRoleSelect(roleKey)}
            >
              <span className="role-card__icon" style={{ background: cfg.bg, color: cfg.color }}>
                <Icon size={24} />
              </span>
              <span className="role-card__info">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, minWidth: 0 }}>
                  <span className="role-card__name">{role.label}</span>
                  <span className="staff-header__badge" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.badge}
                  </span>
                </span>
                <span className="role-card__desc">{role.desc}</span>
              </span>
              <ChevronRight size={18} className="role-card__arrow" />
            </button>
          );
        })}
      </section>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
        Staff credentials required. Contact your supervisor if access is missing.
      </p>
    </main>
  );
}
