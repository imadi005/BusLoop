import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { SHOW_DEMO_LOGIN } from '../config/appMode';

const DEMO_EMAIL = import.meta.env.VITE_DEMO_PASSENGER_EMAIL || '';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSENGER_PASSWORD || '';
const HAS_DEMO_LOGIN = SHOW_DEMO_LOGIN && Boolean(DEMO_EMAIL && DEMO_PASSWORD);

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode]         = useState('login');
  const [form, setForm]         = useState({ email: '', password: '', name: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleChange = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!form.email.trim())    { setError('Please enter your email address.'); return; }
    if (!form.password)        { setError('Please enter your password.'); return; }
    if (mode === 'signup') {
      if (!form.name.trim())   { setError('Please enter your full name.'); return; }
      if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(form.email.trim(), form.password);
        navigate('/');
      } else {
        const result = await signUp(form.email.trim(), form.password, form.name.trim());
        // If a session came back immediately → email confirm is disabled → sign in directly
        if (result?.session) {
          navigate('/');
        } else {
          // Email confirmation is required
          setSuccess('Account created! Check your email for a confirmation link, then sign in here.');
          setMode('login');
          setForm(p => ({ ...p, password: '', name: '' }));
        }
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Please verify your email first — check your inbox.');
      } else if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('An account with this email already exists. Sign in instead.');
        setMode('login');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setMode('login'); setError(''); setSuccess('');
    setForm({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: '' });
  };

  return (
    <div className="login-page page--no-nav">
      <div className="login-page__brand">
        <div className="login-page__logo">
          <img src="/busloop-mark.png" alt="BusLoop" />
        </div>
        <h1 style={{ marginBottom: 4 }}>BusLoop</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Track your bus in real time</p>
      </div>

      <div className="login-page__card">
        {/* Mode Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {[['login', 'Sign In'], ['signup', 'Create Account']].map(([m, label]) => (
            <button key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                background: mode === m ? 'white' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Success */}
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '10px 14px', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, marginBottom: 20 }}>
            ✓ {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: '0.875rem', marginBottom: 20 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="stack stack--md">
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input id="name" type="text" className="form-input"
                placeholder="Your full name"
                value={form.name} onChange={handleChange('name')}
                autoComplete="name" autoFocus={mode === 'signup'} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input id="email" type="email" className="form-input"
              placeholder="you@example.com"
              value={form.email} onChange={handleChange('email')}
              autoComplete="email" autoFocus={mode === 'login'} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={form.password} onChange={handleChange('password')}
                style={{ paddingRight: 44 }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={loading} style={{ marginTop: 8 }}>
            {loading
              ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={18} /></>
            }
          </button>
        </form>

        {HAS_DEMO_LOGIN && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button className="btn btn--secondary btn--full" onClick={fillDemo}>
              Use Demo Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
