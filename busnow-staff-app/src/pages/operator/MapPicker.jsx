/**
 * MapPicker.jsx
 * A modal map component that lets the operator click on the map to pin a location.
 * Returns { lat, lng, label } via onConfirm callback.
 */
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Check, X, Crosshair } from 'lucide-react';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PIN_COLORS = {
  origin: '#12B76A',
  destination: '#EF3E42',
  stop: '#EF3E42',
};

function createPinIcon(color) {
  return L.divIcon({
    html: `<div style="
      width:34px;height:40px;display:flex;flex-direction:column;align-items:center;
      filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));
    ">
      <div style="
        width:34px;height:34px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:${color};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);border:3px solid white;
      ">
        <div style="transform:rotate(45deg);width:10px;height:10px;background:white;border-radius:50%;"></div>
      </div>
    </div>`,
    className: '',
    iconSize: [34, 40],
    iconAnchor: [17, 40],
    popupAnchor: [0, -44],
  });
}

// Inner component to capture map clicks
function MapClickHandler({ onPin }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Geocode search using Nominatim
async function geocodeSearch(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
    { headers: { 'Accept-Language': 'en' } }
  );
  return res.json();
}

// Reverse geocode to get a label from lat/lng
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function MapPicker({
  isOpen,
  onClose,
  onConfirm,
  title = 'Pin Location',
  pinType = 'stop', // 'origin' | 'destination' | 'stop'
  defaultCenter = [23.0225, 72.5714], // India default
  initialLat = null,
  initialLng = null,
}) {
  const [pinned, setPinned]       = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [reverseLabel, setReverseLabel] = useState('');
  const [mapRef, setMapRef]       = useState(null);
  const searchTimer               = useRef(null);

  const pinColor = PIN_COLORS[pinType] || PIN_COLORS.stop;

  useEffect(() => {
    if (isOpen) {
      if (initialLat && initialLng) {
        const pos = { lat: parseFloat(initialLat), lng: parseFloat(initialLng) };
        setPinned(pos);
        reverseGeocode(pos.lat, pos.lng).then(setReverseLabel);
      } else {
        setPinned(null);
        setReverseLabel('');
      }
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, initialLat, initialLng]);

  const handlePin = async (pos) => {
    setPinned(pos);
    setSearchResults([]);
    const label = await reverseGeocode(pos.lat, pos.lng);
    setReverseLabel(label);
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim() || q.length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeSearch(q);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
  };

  const selectSearchResult = (result) => {
    const pos = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setPinned(pos);
    setReverseLabel(result.display_name);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    if (mapRef) mapRef.setView([pos.lat, pos.lng], 16, { animate: true });
  };

  const handleConfirm = () => {
    if (!pinned) return;
    onConfirm({ lat: pinned.lat, lng: pinned.lng, label: reverseLabel });
    onClose();
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPinned(p);
      if (mapRef) mapRef.setView([p.lat, p.lng], 16, { animate: true });
      reverseGeocode(p.lat, p.lng).then(setReverseLabel);
    }, () => {});
  };

  if (!isOpen) return null;

  const center = pinned
    ? [pinned.lat, pinned.lng]
    : defaultCenter;

  // Short label for display
  const shortLabel = reverseLabel
    ? reverseLabel.split(',').slice(0, 2).join(',').trim()
    : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column',
      animation: 'mapPickerIn 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${pinColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MapPin size={16} color={pinColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap the map or search to pin a location</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {/* Search bar */}
      <div style={{ background: 'var(--bg-card)', padding: '10px 16px', flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search for a place..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{ paddingLeft: 34, margin: 0 }}
              autoComplete="off"
            />
          </div>
          <button
            onClick={handleMyLocation}
            title="Use my location"
            style={{
              width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-input)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Crosshair size={16} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
          }}>
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => selectSearchResult(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  fontSize: '0.8125rem', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-main)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {r.display_name.split(',')[0]}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {r.display_name.split(',').slice(1, 3).join(',')}
                </div>
              </button>
            ))}
          </div>
        )}
        {searching && (
          <div style={{ position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          ref={ref => setMapRef(ref)}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapClickHandler onPin={handlePin} />
          {pinned && (
            <Marker position={[pinned.lat, pinned.lng]} icon={createPinIcon(pinColor)} />
          )}
        </MapContainer>

        {/* Cross-hair center hint */}
        {!pinned && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 500, pointerEvents: 'none', textAlign: 'center',
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.65)', color: 'white',
              padding: '8px 16px', borderRadius: 99, fontSize: '0.8125rem', fontWeight: 600,
            }}>
              👆 Tap the map to drop a pin
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{
        background: 'var(--bg-card)', padding: '14px 16px',
        borderTop: '1px solid var(--border)', flexShrink: 0,
      }}>
        {pinned ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', background: `${pinColor}12`,
              border: `1px solid ${pinColor}30`, borderRadius: 10, marginBottom: 12,
            }}>
              <MapPin size={16} color={pinColor} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2, color: pinColor }}>
                  Location Pinned
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {shortLabel || `${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}`}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {pinned.lat.toFixed(6)}, {pinned.lng.toFixed(6)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--secondary" style={{ flex: 1, borderRadius: 12 }} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{
                  flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: pinColor, color: 'white', border: 'none', borderRadius: 12,
                  padding: '12px 0', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                }}
                onClick={handleConfirm}
              >
                <Check size={18} /> Confirm Location
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', padding: '8px 0' }}>
            Tap anywhere on the map to pin your location
          </div>
        )}
      </div>

      <style>{`
        @keyframes mapPickerIn { from { opacity: 0; transform: translateY(20px); } }
      `}</style>
    </div>
  );
}
