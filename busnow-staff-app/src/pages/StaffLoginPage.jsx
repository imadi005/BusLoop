import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Bus, Car, ChevronRight, Eye, EyeOff, Lock, Mail, ShieldCheck, TicketCheck } from 'lucide-react';
import { STAFF_ROLES } from '../data/mockData';
import { useStaffAuth } from '../context/StaffAuthContext';
import { supabase } from '../lib/supabase';
import { SHOW_DEMO_CREDENTIALS } from '../config/appMode';

const ROLE_CONFIG = {
  operator: {
    color: 'var(--operator)',
    bg: 'var(--operator-bg)',
    icon: Bus,
    buttonClass: 'btn--operator',
    label: 'Operator',
  },
  driver: {
    color: 'var(--driver)',
    bg: 'var(--driver-bg)',
    icon: Car,
    buttonClass: 'btn--driver',
    label: 'Driver',
  },
  checker: {
    color: 'var(--checker)',
    bg: 'var(--checker-bg)',
    icon: TicketCheck,
    buttonClass: 'btn--checker',
    label: 'Checker',
  },
};

const ROLE_DASHBOARD = {
  operator: '/dashboard/operator',
  driver: '/dashboard/driver',
  checker: '/dashboard/checker',
  super_admin: '/dashboard/operator',
};

const DEMO_STAFF_PASSWORD = import.meta.env.VITE_DEMO_STAFF_PASSWORD || '';
const SHOW_DEMO_CREDS = SHOW_DEMO_CREDENTIALS && Boolean(DEMO_STAFF_PASSWORD);

const DEMO_CREDS = {
  operator: [
    { email: 'operator1@busnow.app', label: 'Operator 1' },
    { email: 'operator2@busnow.app', label: 'Operator 2' },
  ],
  driver: [
    { email: 'driver1@busnow.app', label: 'Driver 1' },
    { email: 'driver2@busnow.app', label: 'Driver 2' },
  ],
  checker: [
    { email: 'checker1@busnow.app', label: 'Checker 1' },
    { email: 'checker2@busnow.app', label: 'Checker 2' },
  ],
};

export default function StaffLoginPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { signIn } = useStaffAuth();

  const roleInfo = STAFF_ROLES[role] || STAFF_ROLES.driver;
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.driver;
  const RoleIcon = cfg.icon;
  const demoCreds = SHOW_DEMO_CREDS ? (DEMO_CREDS[role] || []) : [];

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { user } = await signIn(form.email, form.password);
      const { data: profile, error: profileErr } = await supabase
        .from('staff')
        .select('role,is_terminated')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile) {
        await supabase.auth.signOut();
        throw new Error('This account does not have staff access.');
      }
      if (profile.is_terminated) {
        await supabase.auth.signOut();
        throw new Error('This staff account has been terminated.');
      }

      const dashboard = ROLE_DASHBOARD[profile.role];
      if (!dashboard) {
        await supabase.auth.signOut();
        throw new Error(`Unknown role "${profile.role}". Contact your supervisor.`);
      }
      navigate(dashboard, { replace: true });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) setError('Wrong email or password. Please try again.');
      else if (msg.includes('Email not confirmed')) setError('Email not confirmed. Contact your supervisor.');
      else setError(msg || 'Sign-in failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillCred = (email) => setForm({ email, password: DEMO_STAFF_PASSWORD });

  return (
    <main className="staff-login-page">
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => navigate('/')}
        style={{ alignSelf: 'flex-start', marginBottom: 24 }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: cfg.bg,
            color: cfg.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
          }}>
            <RoleIcon size={28} />
          </div>
          <div>
            <span className="staff-header__badge" style={{ background: cfg.bg, color: cfg.color, marginBottom: 6 }}>
              {cfg.label} access
            </span>
            <h1>Sign In</h1>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>{roleInfo.desc}</p>
      </section>

      <section className="staff-login-card">
        {error && (
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            background: 'var(--brand-light)',
            color: 'var(--brand-dark)',
            border: '1px solid rgba(239,62,66,0.30)',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 18,
            fontSize: '0.875rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="stack stack--md">
          <div className="form-group">
            <label className="form-label" htmlFor="staff-email">Staff Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="staff-email"
                type="email"
                className="form-input"
                placeholder={`${role || 'staff'}@busnow.app`}
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                autoComplete="email"
                autoFocus
                style={{ paddingLeft: 42 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="staff-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="staff-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
                style={{ paddingLeft: 42, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className={`btn ${cfg.buttonClass} btn--full`} disabled={loading}>
            {loading ? <span className="spinner" /> : <><ShieldCheck size={17} /> Sign In <ChevronRight size={17} /></>}
          </button>
        </form>
      </section>

      {demoCreds.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: cfg.color, letterSpacing: '0.08em', marginBottom: 12 }}>
            DEMO CREDENTIALS
          </div>
          <div className="stack stack--sm">
            {demoCreds.map(cred => (
              <button
                key={cred.email}
                type="button"
                className="btn btn--secondary btn--full"
                onClick={() => fillCred(cred.email)}
                style={{ justifyContent: 'space-between', fontSize: '0.82rem' }}
              >
                <span>{cred.email}</span>
                <span style={{ color: cfg.color, fontWeight: 800 }}>Fill</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
