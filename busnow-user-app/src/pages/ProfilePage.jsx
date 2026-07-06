import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Bus,
  CheckCircle,
  ChevronRight,
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ticketService, reviewService } from '../services/api';
import BottomNav from '../components/BottomNav';

const LS_DEFAULT_LOCATION = 'busnow_profile_default_location';
const LS_NOTIFICATIONS = 'busnow_profile_notifications';

function SectionTitle({ children }) {
  return (
    <h4 style={{
      color: 'var(--text-muted)',
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      margin: '0 0 10px 4px',
      fontWeight: 800,
    }}>
      {children}
    </h4>
  );
}

function ActionRow({ icon: Icon, label, value, onClick, tone = 'brand', disabled = false }) {
  const toneMap = {
    brand: ['var(--brand-light)', 'var(--brand)'],
    green: ['#ECFDF3', 'var(--success)'],
    blue: ['#EFF6FF', 'var(--info)'],
    yellow: ['var(--warning-bg)', 'var(--warning)'],
  };
  const [bg, color] = toneMap[tone] || toneMap.brand;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="settings-item"
      style={{
        width: '100%',
        textAlign: 'left',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="settings-item__icon" style={{ background: bg, color }}>
        <Icon size={18} />
      </div>
      <span className="settings-item__label">{label}</span>
      {value && (
        <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginRight: 4,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      )}
      <ChevronRight size={16} className="settings-item__chevron" />
    </button>
  );
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.18rem', marginBottom: 4 }}>{title}</h2>
            {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, updateProfile } = useAuth();

  const [showLogout, setShowLogout] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultLocation, setDefaultLocation] = useState(() => localStorage.getItem(LS_DEFAULT_LOCATION) || '');
  const [notificationsOn, setNotificationsOn] = useState(() => localStorage.getItem(LS_NOTIFICATIONS) === 'true');
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

  useEffect(() => {
    setEditForm({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    });
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoadingStats(true);
    Promise.allSettled([
      ticketService.getMyTickets(user.id),
      reviewService.getAll(),
    ]).then(([ticketRes, reviewRes]) => {
      if (!mounted) return;
      setTickets(ticketRes.status === 'fulfilled' ? ticketRes.value || [] : []);
      const allReviews = reviewRes.status === 'fulfilled' ? reviewRes.value || [] : [];
      setReviews(allReviews.filter((review) => review.passenger_id === user.id));
    }).finally(() => mounted && setLoadingStats(false));

    return () => { mounted = false; };
  }, [user]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await signOut();
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      flash('Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
      });
      setActiveModal(null);
      flash('Profile updated.');
    } catch (err) {
      flash(err?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async () => {
    if (!('Notification' in window)) {
      flash('Notifications are not supported on this browser.');
      return;
    }

    if (!notificationsOn && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        flash('Notification permission was not allowed.');
        return;
      }
    }

    const next = !notificationsOn;
    setNotificationsOn(next);
    localStorage.setItem(LS_NOTIFICATIONS, String(next));
    flash(next ? 'Notifications enabled.' : 'Notifications disabled.');
  };

  const handleSaveDefaultLocation = () => {
    localStorage.setItem(LS_DEFAULT_LOCATION, defaultLocation.trim());
    setActiveModal(null);
    flash(defaultLocation.trim() ? 'Default location saved.' : 'Default location cleared.');
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.password.length < 8) {
      flash('Password must be at least 8 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      flash('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) throw error;
      setPasswordForm({ password: '', confirm: '' });
      setActiveModal(null);
      flash('Password updated.');
    } catch (err) {
      flash(err?.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const openSupportMail = () => {
    window.location.href = `mailto:support@busnow.app?subject=${encodeURIComponent('BusLoop support request')}`;
  };

  const savedRoutes = useMemo(() => {
    const routes = new Map();
    tickets.forEach((ticket) => {
      const name = ticket.route_name || ticket.routes?.name;
      if (!name || name === 'Unknown Route') return;
      routes.set(name, {
        name,
        bus: ticket.bus_name || ticket.trips?.buses?.name || 'Bus',
        count: (routes.get(name)?.count || 0) + 1,
      });
    });
    return Array.from(routes.values()).sort((a, b) => b.count - a.count);
  }, [tickets]);

  if (!user) {
    return (
      <div className="page">
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="empty-state">
            <User size={42} color="var(--text-muted)" />
            <h3>Not signed in</h3>
            <p>Sign in to view your profile.</p>
          </div>
          <button className="btn btn--primary btn--full" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';
  const avatarLetter = displayName[0]?.toUpperCase() || 'U';
  const email = user.email || '';
  const usedTickets = tickets.filter((ticket) => ticket.status === 'used').length;
  const activeTickets = tickets.filter((ticket) => ticket.status === 'active').length;

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {notice && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 'calc(100% - 32px)',
          background: 'var(--text-primary)',
          color: 'white',
          borderRadius: 999,
          padding: '10px 16px',
          fontSize: '0.82rem',
          fontWeight: 800,
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}>
          {notice}
        </div>
      )}

      <div style={{ padding: '18px 16px 92px' }}>
        <div className="card" style={{
          padding: 18,
          borderRadius: 24,
          borderColor: 'rgba(239,62,66,0.18)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7F7 100%)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              background: 'var(--brand)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: 900,
              boxShadow: 'var(--shadow-brand)',
              flexShrink: 0,
            }}>
              {avatarLetter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <h2 style={{ fontSize: '1.22rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</h2>
                <span className="badge badge--active" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                  Passenger
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
              <button onClick={() => setActiveModal('edit')} className="btn btn--secondary btn--sm" style={{ borderRadius: 999, marginTop: 10 }}>
                Edit Profile
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
            {[
              { label: 'Tickets', value: loadingStats ? '-' : tickets.length },
              { label: 'Used', value: loadingStats ? '-' : usedTickets },
              { label: 'Reviews', value: loadingStats ? '-' : reviews.length },
            ].map((item) => (
              <div key={item.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.12rem', fontWeight: 900, color: 'var(--text-primary)' }}>{item.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <SectionTitle>Contact</SectionTitle>
            <div className="settings-group">
              <ActionRow icon={Mail} label={email} value="Email" onClick={() => setActiveModal('edit')} tone="brand" />
              <ActionRow icon={Phone} label={profile?.phone || 'Add phone number'} value={profile?.phone ? 'Phone' : ''} onClick={() => setActiveModal('edit')} tone="blue" />
            </div>
          </div>

          <div>
            <SectionTitle>Preferences</SectionTitle>
            <div className="settings-group">
              <ActionRow
                icon={Bell}
                label="Notifications"
                value={notificationsOn ? 'On' : 'Off'}
                onClick={handleNotificationToggle}
                tone={notificationsOn ? 'green' : 'brand'}
              />
              <ActionRow
                icon={MapPin}
                label="Default Location"
                value={defaultLocation || 'Not set'}
                onClick={() => setActiveModal('location')}
                tone="blue"
              />
              <ActionRow
                icon={Bus}
                label="Saved Routes"
                value={savedRoutes.length ? `${savedRoutes.length}` : 'None'}
                onClick={() => setActiveModal('routes')}
                tone="yellow"
              />
            </div>
          </div>

          <div>
            <SectionTitle>Account</SectionTitle>
            <div className="settings-group">
              <ActionRow icon={Ticket} label="Active Tickets" value={`${activeTickets}`} onClick={() => navigate('/tickets')} tone="green" />
              <ActionRow icon={Shield} label="Security & Password" value="Update" onClick={() => setActiveModal('password')} tone="blue" />
            </div>
          </div>

          <div>
            <SectionTitle>Support</SectionTitle>
            <div className="settings-group">
              <ActionRow icon={HelpCircle} label="Help & Support" value="Email" onClick={openSupportMail} tone="blue" />
              <ActionRow icon={Star} label="Rate Trips" value="Reviews" onClick={() => navigate('/reviews')} tone="yellow" />
            </div>
          </div>

          <button className="btn btn--ghost btn--full" style={{ borderColor: 'var(--brand)', color: 'var(--brand)', borderRadius: 16 }} onClick={() => setShowLogout(true)}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {activeModal === 'edit' && (
        <Modal title="Edit Profile" subtitle="Keep your passenger details up to date." onClose={() => setActiveModal(null)}>
          <div className="stack stack--md">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={editForm.full_name} onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Optional" />
            </div>
            <button className="btn btn--primary btn--full" onClick={handleSaveProfile} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === 'location' && (
        <Modal title="Default Location" subtitle="Used as your preferred starting point in BusLoop." onClose={() => setActiveModal(null)}>
          <div className="stack stack--md">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={defaultLocation} onChange={(event) => setDefaultLocation(event.target.value)} placeholder="e.g. Kothanur" autoFocus />
            </div>
            <button className="btn btn--primary btn--full" onClick={handleSaveDefaultLocation}>Save Location</button>
            <button className="btn btn--secondary btn--full" onClick={() => { setDefaultLocation(''); localStorage.removeItem(LS_DEFAULT_LOCATION); setActiveModal(null); flash('Default location cleared.'); }}>Clear</button>
          </div>
        </Modal>
      )}

      {activeModal === 'routes' && (
        <Modal title="Saved Routes" subtitle="Based on your booked ticket history." onClose={() => setActiveModal(null)}>
          {savedRoutes.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 10px' }}>
              <Bus size={38} color="var(--text-muted)" />
              <h3>No routes yet</h3>
              <p>Book tickets and your frequent routes will appear here.</p>
            </div>
          ) : (
            <div className="stack stack--sm">
              {savedRoutes.map((route) => (
                <div key={route.name} className="card" style={{ boxShadow: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="settings-item__icon"><Bus size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{route.count} booking{route.count === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {activeModal === 'password' && (
        <Modal title="Security & Password" subtitle="Use at least 8 characters for your new password." onClose={() => setActiveModal(null)}>
          <div className="stack stack--md">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, password: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))} />
            </div>
            <button className="btn btn--primary btn--full" onClick={handlePasswordUpdate} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Update Password'}
            </button>
          </div>
        </Modal>
      )}

      {showLogout && (
        <Modal title="Sign Out?" subtitle="You will need to sign in again to view tickets and bookings." onClose={() => setShowLogout(false)}>
          <div className="stack stack--sm">
            <button className="btn btn--primary btn--full" onClick={handleLogout}>Yes, Sign Out</button>
            <button className="btn btn--secondary btn--full" onClick={() => setShowLogout(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      <BottomNav />
    </div>
  );
}
