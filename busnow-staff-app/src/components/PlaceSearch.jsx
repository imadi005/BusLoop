import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X } from 'lucide-react';

const tint = (color, amount = 12) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

/* ─────────────────────────────────────────────────────────
   Curated Bangalore places for instant autocomplete
───────────────────────────────────────────────────────── */
export const BANGALORE_PLACES = [
  // Airports & Stations
  'Kempegowda International Airport', 'Bangalore Airport', 'Kempegowda Bus Terminal', 'Majestic',
  'Yeshwanthpur Railway Station', 'Bangalore City Railway Station', 'Cantonment Railway Station',
  'Krishnarajapuram Railway Station', 'Whitefield Railway Station',
  // Major Areas - North
  'Hebbal', 'Thanisandra', 'Kalyan Nagar', 'HBR Layout', 'Hennur', 'Kothanur', 'Nagawara',
  'Geddalahalli', 'Banaswadi', 'Lingarajapuram', 'Ramamurthy Nagar', 'Horamavu',
  'Devanahalli', 'Yelahanka', 'Jakkur', 'Sahakar Nagar', 'Sadahalli', 'Vidyaranyapura',
  // Major Areas - South
  'Jayanagar', 'JP Nagar', 'Banashankari', 'BTM Layout', 'Koramangala', 'HSR Layout',
  'Bommanahalli', 'Begur', 'Hulimavu', 'Electronic City', 'Silk Board', 'Hongasandra',
  'Gottigere', 'Kanakapura Road', 'Akshayanagar', 'Arekere', 'Subramanyapura',
  'Padmanabhanagar', 'Uttarahalli', 'Talaghattapura',
  // Major Areas - East
  'Whitefield', 'Marathahalli', 'Domlur', 'Indiranagar', 'HAL Airport Road', 'Tin Factory',
  'KR Puram', 'Mahadevapura', 'Brookefield', 'ITPL', 'Kundalahalli', 'Garudacharapalya',
  'Varthur', 'Sarjapur', 'Bellandur', 'Outer Ring Road', 'EPIP Zone', 'Kadugodi',
  // Major Areas - West
  'Rajajinagar', 'Basaveshwara Nagar', 'Vijayanagar', 'Magadi Road', 'Kengeri',
  'Rajarajeshwari Nagar', 'Nagarbhavi', 'Nayandahalli', 'Peenya', 'Yeshwanthpur',
  'Dasarahalli', 'Jalahalli', 'HMT Layout', 'Chord Road', 'Kamakshipalya',
  // Central
  'MG Road', 'Brigade Road', 'Church Street', 'Cubbon Park', 'Lalbagh', 'Richmond Circle',
  'Shivajinagar', 'Vasanth Nagar', 'Sankey Road', 'Palace Grounds', 'Ulsoor',
  'Cleveland Town', 'Frazer Town', 'Cox Town', 'Commercial Street',
  // Hubs & Landmarks
  'Manyata Tech Park', 'Embassy Tech Village', 'RMZ Infinity', 'Bagmane Tech Park',
  'Prestige Tech Park', 'Ecospace', 'Aero SE Tech Park', 'Global Village Tech Park',
  'Christ University', 'BMS College', 'Visvesvaraya Museum', 'NIMHANS',
  'Cunningham Road', 'Residency Road', 'Kasturba Road',
  // Outer Areas
  'Tumkur Road', 'Hosur Road', 'Old Madras Road', 'Bellary Road',
  'Mysore Road', 'Bannerghatta Road', 'Sarjapur Road',
  'Doddaballapur', 'Nelamangala', 'Hoskote', 'Attibele', 'Bidadi',
  // Towns / Smaller Areas
  'Shivaji Nagar', 'Malleswaram', 'Seshadripuram', 'Srirampura', 'Mathikere',
  'Sanjay Nagar', 'RT Nagar', 'Dollars Colony', 'Kammanahalli', 'CV Raman Nagar',
  'Old Airport Road', 'New BEL Road', 'MS Ramaiah', 'Sanjaynagar',
];

/**
 * PlaceSearch — works anywhere including inside overflow:auto/hidden modals.
 * The dropdown is rendered as position:fixed using the input's bounding rect,
 * so it is NEVER clipped by a parent scroll container.
 *
 * Props:
 *   label       – small uppercase label above the input (optional)
 *   value       – controlled value
 *   onChange    – called with new string on every change
 *   placeholder – input placeholder
 *   color       – accent colour (e.g. 'var(--success)')
 *   icon        – emoji or string shown on the left (optional)
 */
export default function PlaceSearch({ label, value, onChange, placeholder, color = '#EF3E42', icon }) {
  const [query, setQuery]           = useState(value || '');
  const [localResults, setLocal]    = useState([]);
  const [apiResults, setApi]        = useState([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  // Position of the fixed dropdown
  const [dropPos, setDropPos]       = useState({ top: 0, left: 0, width: 0 });

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Sync external value changes
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Reposition dropdown whenever it opens or window scrolls/resizes
  const reposition = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Instant local filter
  const filterLocal = useCallback((q) => {
    if (!q || q.length < 1) { setLocal([]); return; }
    const lower = q.toLowerCase();
    setLocal(
      BANGALORE_PLACES
        .filter(p => p.toLowerCase().includes(lower))
        .slice(0, 6)
        .map(p => ({ label: p, sub: 'Bangalore, Karnataka', isLocal: true }))
    );
  }, []);

  // Nominatim API search (debounced)
  const searchApi = useCallback((q) => {
    if (!q || q.length < 2) { setApi([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(q + ' Bangalore')}&format=json&addressdetails=1&limit=5` +
          `&countrycodes=in&viewbox=77.3,12.7,77.85,13.25&bounded=1`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        const seen = new Set();
        setApi(
          data.map(r => {
            const a = r.address || {};
            const name =
              a.neighbourhood || a.suburb || a.quarter ||
              a.village || a.town || a.city_district ||
              a.county || r.display_name.split(',')[0];
            return { label: name, sub: 'Bangalore, Karnataka', isLocal: false };
          })
          .filter(i => {
            if (!i.label || seen.has(i.label)) return false;
            seen.add(i.label); return true;
          })
        );
      } catch { setApi([]); }
      finally { setLoading(false); }
    }, 400);
  }, []);

  // Merged results (local first, deduplicated)
  const results = (() => {
    const all = [...localResults];
    const localSet = new Set(localResults.map(r => r.label.toLowerCase()));
    for (const r of apiResults) {
      if (!localSet.has(r.label.toLowerCase())) all.push(r);
      if (all.length >= 8) break;
    }
    return all;
  })();

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    filterLocal(q);
    searchApi(q);
    setOpen(true);
    reposition();
  };

  const pick = (item) => {
    setQuery(item.label);
    onChange(item.label);
    setLocal([]); setApi([]);
    setOpen(false);
  };

  const clear = () => {
    setQuery(''); onChange('');
    setLocal([]); setApi([]);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <div style={{
          fontSize: '0.68rem', fontWeight: 700,
          color, letterSpacing: '0.08em', marginBottom: 6,
        }}>
          {label}
        </div>
      )}

      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-input)',
        border: `1.5px solid ${open ? color : 'var(--border)'}`,
        borderRadius: 14, padding: '11px 14px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: open ? `0 0 0 3px ${tint(color, 14)}` : 'none',
      }}>
        {icon && <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>}
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={handleInput}
          onFocus={() => {
            setOpen(true);
            reposition();
            if (query.length >= 1) { filterLocal(query); searchApi(query); }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '0.9375rem',
            fontFamily: 'var(--font-main)',
          }}
        />
        {loading
          ? <div style={{ width: 14, height: 14, border: `2px solid ${tint(color, 12)}`, borderTopColor: color, borderRadius: '50%', animation: 'psSpin 0.7s linear infinite', flexShrink: 0 }} />
          : query
            ? <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, flexShrink: 0, display: 'flex' }}><X size={15} /></button>
            : <Search size={14} color="#334155" style={{ flexShrink: 0 }} />
        }
      </div>

      {/* ── Fixed-position dropdown — never clipped by parent overflow ── */}
      {open && results.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top:   dropPos.top,
            left:  dropPos.left,
            width: dropPos.width,
            zIndex: 99999,
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => pick(r)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 14px', textAlign: 'left',
                fontFamily: 'var(--font-main)',
                borderBottom: i < results.length - 1
                  ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <MapPin size={14} color={r.isLocal ? color : 'var(--text-secondary)'} style={{ flexShrink: 0, marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{r.label}</div>
                {r.sub && (
                  <div style={{ fontSize: '0.72rem', color: '#667085', marginTop: 1 }}>{r.sub}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes psSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
