import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Bus, Route, Ticket, Star, Clock, Activity, CheckCircle, AlertCircle, IndianRupee, Trophy } from 'lucide-react';
import { analyticsService } from '../../services/api';

const tint = (color, amount = 12) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function fmtDuration(minutes) {
  if (!minutes || minutes < 1) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/* ─────────────────────────────────────────
   Collection Bar Chart
───────────────────────────────────────── */
function CollectionChart({ data, color = 'var(--brand)' }) {
  if (!data || data.length === 0) return null;
  const maxAmt = Math.max(...data.map(d => d.amount), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 12 }}>
      {data.map((item, i) => {
        const pct = Math.round((item.amount / maxAmt) * 100);
        const isToday = item.label === 'Today';
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div style={{ fontSize: '0.6rem', color: color, fontWeight: 700, opacity: item.amount > 0 ? 1 : 0 }}>
              {item.amount > 0 ? fmtCurrency(item.amount) : ''}
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 68 }}>
              <div style={{
                width: '100%',
                height: `${Math.max(pct, item.amount > 0 ? 4 : 1)}%`,
                minHeight: item.amount > 0 ? 4 : 1,
                background: isToday
                  ? `linear-gradient(180deg, ${color}, ${tint(color, 58)})`
                  : tint(color, 24),
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.6s cubic-bezier(.4,0,.2,1)',
                border: isToday ? `1px solid ${color}` : 'none',
              }} />
            </div>
            <div style={{ fontSize: '0.6rem', color: isToday ? color : 'var(--text-muted)', fontWeight: isToday ? 700 : 400, textAlign: 'center', lineHeight: 1 }}>
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color, gradient }) {
  return (
    <div style={{
      background: gradient || 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -12, right: -12,
        width: 64, height: 64, borderRadius: '50%',
        background: tint(color, 12),
      }}/>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: tint(color, 14), color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16}/>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.2 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}

function FleetDonut({ active, maintenance, inactive, total }) {
  if (!total) return null;
  const pct = (n) => Math.round((n / total) * 100);
  const segments = [
    { label: 'Active',      value: active,      color: 'var(--success)', pct: pct(active) },
    { label: 'Maintenance', value: maintenance,  color: 'var(--violet)', pct: pct(maintenance) },
    { label: 'Inactive',    value: inactive,     color: '#667085', pct: pct(inactive) },
  ].filter(s => s.value > 0);

  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 12, marginBottom: 12 }}>
        {segments.map(s => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, transition: 'width 0.6s ease' }}/>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {s.label} <strong style={{ color: s.color }}>{s.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RouteBar({ route, maxTrips }) {
  const pct = maxTrips ? Math.round((route.total / maxTrips) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: route.color, flexShrink: 0 }}/>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {route.name}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {route.total} trip{route.total !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: route.color,
          borderRadius: 99,
          transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
          opacity: 0.85,
        }}/>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--success)' }}>● {route.active} active</span>
        <span>● {route.completed} completed</span>
      </div>
    </div>
  );
}

function RecentTripRow({ trip }) {
  const isActive    = trip.status === 'active';
  const duration    = trip.started_at && trip.ended_at
    ? fmtDuration((new Date(trip.ended_at) - new Date(trip.started_at)) / 60000)
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: isActive ? 'rgba(18,183,106,0.15)' : 'var(--bg-input)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isActive
          ? <Activity size={15} color="var(--success)"/>
          : <CheckCircle size={15} color="#4A5D80"/>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {trip.buses?.name || 'Unknown Bus'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {trip.routes?.name || 'Unassigned'} · {fmtDate(trip.started_at)} {fmtTime(trip.started_at)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {isActive ? (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)',
            background: 'rgba(18,183,106,0.15)', padding: '2px 8px', borderRadius: 99,
          }}>LIVE</span>
        ) : duration ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{duration}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Top Buses by Collection
───────────────────────────────────────── */
const MEDALS = ['🥇', '🥈', '🥉'];

function TopBusRow({ bus, rank }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '1.3rem', flexShrink: 0, width: 28, textAlign: 'center' }}>
        {MEDALS[rank] || `#${rank + 1}`}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bus.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{bus.registration_no}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>{fmtCurrency(bus.total)}</div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{bus.count} tickets</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main Analytics Component
───────────────────────────────────────── */
const CHART_PERIODS = [
  { id: 'day',   label: 'Daily' },
  { id: 'week',  label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

export default function OperatorAnalytics() {
  const [overview,      setOverview]      = useState(null);
  const [routeStats,    setRouteStats]    = useState([]);
  const [busStats,      setBusStats]      = useState([]);
  const [recentTrips,   setRecentTrips]   = useState([]);
  const [topBuses,      setTopBuses]      = useState([]);
  const [todayCol,      setTodayCol]      = useState(null);
  const [chartData,     setChartData]     = useState([]);
  const [chartPeriod,   setChartPeriod]   = useState('day');
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [chartLoading,  setChartLoading]  = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ov, rs, bs, rt, top, today, chart] = await Promise.allSettled([
        analyticsService.getOverview(),
        analyticsService.getRouteStats(),
        analyticsService.getBusStats(),
        analyticsService.getRecentTrips(),
        analyticsService.getTopBusesByCollection(3),
        analyticsService.getTodayCollection(),
        analyticsService.getCollectionStats(chartPeriod),
      ]);
      if (ov.status === 'fulfilled')    setOverview(ov.value);
      if (rs.status === 'fulfilled')    setRouteStats(rs.value);
      if (bs.status === 'fulfilled')    setBusStats(bs.value);
      if (rt.status === 'fulfilled')    setRecentTrips(rt.value);
      if (top.status === 'fulfilled')   setTopBuses(top.value);
      if (today.status === 'fulfilled') setTodayCol(today.value);
      if (chart.status === 'fulfilled') setChartData(chart.value);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Analytics] Load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartPeriod]);

  useEffect(() => { load(); }, [load]);

  const handlePeriodChange = async (period) => {
    setChartPeriod(period);
    setChartLoading(true);
    try {
      const data = await analyticsService.getCollectionStats(period);
      setChartData(data);
    } catch { /* ignore */ }
    finally { setChartLoading(false); }
  };

  const maxRouteTrips = routeStats.reduce((m, r) => Math.max(m, r.total), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}/>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading analytics…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>Bus Overview</h3>
          {lastUpdated && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,62,66,0.1)', color: 'var(--brand)',
            border: '1px solid rgba(239,62,66,0.25)', borderRadius: 99,
            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600,
            cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1,
          }}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}}/>
          Refresh
        </button>
      </div>

      {/* ── Today's Collection Hero Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(18,183,106,0.15) 0%, rgba(59,130,246,0.1) 100%)',
        border: '1px solid rgba(18,183,106,0.3)',
        borderRadius: 20,
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(18,183,106,0.08)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(18,183,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee size={18} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Today's Collection</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {todayCol ? `${todayCol.count} tickets sold` : 'Loading…'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {todayCol ? fmtCurrency(todayCol.total) : '—'}
        </div>
        {todayCol?.total === 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            No tickets sold today yet. Revenue will appear here as tickets are booked.
          </div>
        )}
      </div>

      {/* ── Collection Graph ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h4>Collection Trend</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            {CHART_PERIODS.map(p => (
              <button key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                style={{
                  padding: '4px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: chartPeriod === p.id ? 'var(--brand)' : 'var(--bg-input)',
                  color:      chartPeriod === p.id ? 'white'   : 'var(--text-muted)',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          {chartPeriod === 'day' ? 'Last 7 days' : chartPeriod === 'week' ? 'Last 8 weeks' : 'Last 6 months'}
        </p>
        {chartLoading
          ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 24, height: 24 }}/></div>
          : <CollectionChart data={chartData} color="var(--brand)" />
        }
        {chartData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--text-primary)' }}>
                {fmtCurrency(chartData.reduce((s, d) => s + d.amount, 0))}
              </strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {chartData.reduce((s, d) => s + d.count, 0)} tickets
            </div>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KpiCard icon={Bus}        label="Total Buses"      value={overview.totalBuses}    sub={`${overview.activeBuses} active now`}  color="var(--info)"/>
          <KpiCard icon={Activity}   label="Active Trips"     value={overview.activeTrips}   sub={`${overview.completedTrips} completed`} color="var(--success)"/>
          <KpiCard icon={TrendingUp} label="Trips Today"      value={overview.tripsToday}    sub={`${overview.tripsThisWeek} this week`}  color="var(--brand)"/>
          <KpiCard icon={Ticket}     label="Tickets Booked"   value={overview.totalTickets}  sub={overview.ticketsToday ? `${overview.ticketsToday} today` : null} color="var(--violet)"/>
          {overview.avgRating && (
            <KpiCard icon={Star}   label="Avg Rating"   value={`${overview.avgRating}★`} sub={`${overview.totalReviews} reviews`} color="var(--warning)"/>
          )}
          <KpiCard icon={CheckCircle} label="Completed Trips" value={overview.completedTrips} sub={null} color="#06B6D4"/>
        </div>
      )}

      {/* ── Top 3 Buses by Collection ── */}
      {topBuses.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Trophy size={16} color="var(--warning)" />
            <h4 style={{ margin: 0 }}>Top Performing Buses</h4>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>by collection</span>
          </div>
          <div>
            {topBuses.map((bus, i) => <TopBusRow key={bus.id} bus={bus} rank={i} />)}
          </div>
        </div>
      )}

      {/* Fleet Status */}
      {overview && overview.totalBuses > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4>Bus Status</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{overview.totalBuses} buses</span>
          </div>
          <FleetDonut
            active={overview.activeBuses}
            maintenance={overview.maintenanceBuses}
            inactive={overview.inactiveBuses}
            total={overview.totalBuses}
          />
        </div>
      )}

      {/* Route Performance */}
      {routeStats.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4>Route Activity</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{routeStats.length} routes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {routeStats.map(r => (
              <RouteBar key={r.id} route={r} maxTrips={maxRouteTrips}/>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trips */}
      {recentTrips.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h4>Recent Trips</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 10</span>
          </div>
          <div>
            {recentTrips.map(t => <RecentTripRow key={t.id} trip={t}/>)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!overview?.totalTrips && routeStats.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">📊</div>
          <h3>No data yet</h3>
          <p style={{ fontSize: '0.8125rem' }}>Analytics will populate as buses run trips.</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
