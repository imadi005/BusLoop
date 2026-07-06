import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { busService } from '../services/api';
import { supabase } from '../lib/supabase';
import { MOCK_BUSES } from '../data/mockData';
import BusCard from '../components/BusCard';
import BottomNav from '../components/BottomNav';
import { canUseMockData } from '../config/appMode';

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'active',   label: 'Active' },
  { id: 'delayed',  label: 'Delayed' },
  { id: 'inactive', label: 'Inactive' },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery]           = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [buses, setBuses]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const loadBuses = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active trips to get live custom routes
      const { data: trips } = await supabase
        .from('trips')
        .select('bus_id,from_location,to_location')
        .eq('status', 'active');

      const tripMap = {};
      if (trips) {
        trips.forEach(t => { tripMap[t.bus_id] = t; });
      }

      // 2. Fetch buses
      const data = await busService.getAll();
      const busList = data.length > 0 ? data : (canUseMockData() ? MOCK_BUSES : []);

      // 3. Map custom trip origin/destination if bus is active
      const finalBusList = busList.map(b => {
        const t = tripMap[b.id];
        if (t) {
          return {
            ...b,
            route_origin:      t.from_location || b.route_origin      || null,
            route_destination: t.to_location   || b.route_destination || null,
          };
        }
        return b;
      });

      setBuses(finalBusList);
    } catch {
      setBuses(canUseMockData() ? MOCK_BUSES : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuses(); }, [loadBuses]);

  const filtered = buses.filter(bus => {
    const q = query.toLowerCase();
    const matchQuery = !query
      || (bus.name || '').toLowerCase().includes(q)
      || (bus.route_name || '').toLowerCase().includes(q)
      || (bus.registration_no || '').toLowerCase().includes(q)
      || (bus.route_origin || '').toLowerCase().includes(q)
      || (bus.route_destination || bus.route_dest || '').toLowerCase().includes(q)
      || (bus.route_keywords || '').toLowerCase().includes(q)
      || (bus.route_landmarks || '').toLowerCase().includes(q);
    const matchFilter = activeFilter === 'all' || bus.status === activeFilter;
    return matchQuery && matchFilter;
  });


  return (
    <div className="page page--no-nav" style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky search header */}
      <div className="search-page-header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
          aria-label="Go back"
        >
          <ArrowLeft size={22} color="var(--text-primary)" />
        </button>
        <div className="search-input-row">
          <Search size={17} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search buses, routes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} color="var(--text-muted)" />
            </button>
          )}
        </div>
        <button onClick={loadBuses} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} aria-label="Refresh">
          <RefreshCw size={17} color="var(--text-muted)" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              padding: '6px 16px', borderRadius: 99,
              border: `1.5px solid ${activeFilter === f.id ? 'var(--brand)' : 'var(--border)'}`,
              background: activeFilter === f.id ? 'var(--brand)' : 'white',
              color: activeFilter === f.id ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'var(--font-main)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p>Loading buses…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <h3>No results found</h3>
            <p>Try a different search term or filter</p>
          </div>
        ) : (
          <div className="stack stack--sm">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              {filtered.length} bus{filtered.length !== 1 ? 'es' : ''} found
            </p>
            {filtered.map(bus => <BusCard key={bus.id} bus={bus} />)}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
