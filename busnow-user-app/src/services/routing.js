/**
 * Fetches a road-snapped route from OSRM (free, no API key, OpenStreetMap).
 * @param {Array<{lat:number,lng:number}>} waypoints
 * @returns {Array<[lat,lng]>} road geometry coordinates for Leaflet Polyline
 */
export async function getRoadRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return [];

  // Filter out invalid points
  const valid = waypoints.filter(w => w && w.lat && w.lng && !isNaN(w.lat) && !isNaN(w.lng));
  if (valid.length < 2) return [];

  // OSRM expects: lng,lat pairs separated by semicolons
  const coords = valid.map(w => `${parseFloat(w.lng).toFixed(6)},${parseFloat(w.lat).toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]?.geometry?.coordinates) return [];

    // OSRM returns [lng, lat] — convert to Leaflet [lat, lng]
    return json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch (err) {
    console.warn('[OSRM] Routing failed, falling back to straight lines:', err.message);
    // Fallback: straight lines between stops
    return valid.map(w => [parseFloat(w.lat), parseFloat(w.lng)]);
  }
}
