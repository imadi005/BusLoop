import { supabase } from '../lib/supabase';
import { TICKET_VALIDITY_MS } from '../utils/ticketValidity';

// ══════════════════════════════════════════════
// BUSES
// ══════════════════════════════════════════════
export const busService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('buses')
      .select('*, routes ( id, name, color, origin, destination, base_fare )')
      .order('name');
    if (error) throw error;
    return data.map(bus => ({
      ...bus,
      route_name:    bus.routes?.name        ?? 'Unassigned',
      route_color:   bus.routes?.color       ?? '#667085',
      route_origin:  bus.routes?.origin      ?? null,
      route_dest:    bus.routes?.destination ?? null,
      base_fare:     bus.routes?.base_fare   ?? 30,
    }));
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('buses')
      .select('*, routes ( id, name, color, origin, destination, base_fare )')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      route_name:    data.routes?.name        ?? 'Unassigned',
      route_color:   data.routes?.color       ?? '#667085',
      route_origin:  data.routes?.origin      ?? null,
      route_dest:    data.routes?.destination ?? null,
      base_fare:     data.routes?.base_fare   ?? 30,
    };
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('buses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  insert: async (bus) => {
    const corePayload = {
      name:            bus.name,
      registration_no: bus.registration_no,
      capacity:        bus.capacity ?? 50,
      status:          bus.status ?? 'inactive',
    };
    const payload = { ...corePayload };
    if (bus.photo_url)   payload.photo_url   = bus.photo_url;
    if (bus.destination) payload.destination = bus.destination;
    if (bus.route_id)    payload.route_id    = bus.route_id;

    const insertBus = (body) => supabase
      .from('buses')
      .insert(body)
      .select()
      .single();

    let { data, error } = await insertBus(payload);
    if (error) {
      const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      const hasOptionalSchemaMismatch =
        msg.includes('schema cache') ||
        msg.includes('destination') ||
        msg.includes('photo_url');

      if (hasOptionalSchemaMismatch && (payload.destination || payload.photo_url)) {
        ({ data, error } = await insertBus(corePayload));
      }
    }

    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase
      .from('buses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};


// ══════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════
export const routeService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async ({ name, color, origin, destination, landmarks, notes, searchKeywords }) => {
    const routeName = origin && destination ? `${origin} → ${destination}` : name;
    const { data, error } = await supabase
      .from('routes')
      .insert({
        name:            routeName,
        color:           color || 'var(--brand)',
        origin:          origin || null,
        destination:     destination || null,
        landmarks:       landmarks || null,
        notes:           notes || null,
        search_keywords: searchKeywords || null,
        is_active:       true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, updates) => {
    const payload = {};
    if (updates.origin !== undefined)      payload.origin          = updates.origin;
    if (updates.destination !== undefined) payload.destination     = updates.destination;
    if (updates.landmarks !== undefined)   payload.landmarks       = updates.landmarks;
    if (updates.notes !== undefined)       payload.notes           = updates.notes;
    if (updates.searchKeywords !== undefined) payload.search_keywords = updates.searchKeywords;
    if (updates.color !== undefined)       payload.color           = updates.color;
    if (updates.name !== undefined)        payload.name            = updates.name;
    if (updates.is_active !== undefined)   payload.is_active       = updates.is_active;

    const { data, error } = await supabase
      .from('routes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Get stops for a route
  getStops: async (routeId) => {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('route_id', routeId)
      .order('stop_order');
    if (error) throw error;
    return data;
  },

  // Upsert stops for a route (replaces all stops)
  upsertStops: async (routeId, stops) => {
    // Delete existing stops first
    await supabase.from('stops').delete().eq('route_id', routeId);

    if (!stops || stops.length === 0) return [];

    const toInsert = stops.map((s, i) => ({
      route_id:   routeId,
      name:       s.name,
      lat:        parseFloat(s.lat) || 0,
      lng:        parseFloat(s.lng) || 0,
      stop_order: i + 1,
      stop_type:  s.stop_type || 'stop',
    }));

    const { data, error } = await supabase
      .from('stops')
      .insert(toInsert)
      .select();
    if (error) throw error;
    return data;
  },
};

// ══════════════════════════════════════════════
// ROUTE PRESETS (Smart autocomplete)
// ══════════════════════════════════════════════
export const presetService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('route_presets')
      .select('*')
      .order('use_count', { ascending: false });
    // Gracefully return empty if table doesn't exist yet
    if (error) {
      console.warn('[presetService] Presets table not ready:', error.message);
      return [];
    }
    return data;
  },

  // Upsert a preset (increment use_count on conflict)
  record: async (type, label, lat = null, lng = null) => {
    // Try insert; if conflict on label+type, increment use_count
    const { data: existing } = await supabase
      .from('route_presets')
      .select('id, use_count')
      .eq('type', type)
      .eq('label', label)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('route_presets')
        .update({ use_count: existing.use_count + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('route_presets')
        .insert({ type, label, lat, lng, use_count: 1 })
        .select()
        .single();
    }
  },
};

// ══════════════════════════════════════════════
// STAFF
// ══════════════════════════════════════════════
export const staffService = {
  getDrivers: async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'driver');
    if (error) throw error;
    return data;
  },

  getCheckers: async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'checker');
    if (error) throw error;
    return data;
  },

  getOperators: async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .in('role', ['operator', 'super_admin']);
    if (error) throw error;
    return data;
  },

  /** All drivers + checkers (for operator employees list) */
  getAllStaff: async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .in('role', ['driver', 'checker'])
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  /** Add a new staff member (creates auth user + staff row) */
  addStaff: async ({ full_name, email, password, phone, role, employee_id }) => {
    if (!password) throw new Error('Password is required to create a staff login');

    const { data, error } = await supabase.functions.invoke('staff-create', {
      body: { full_name, email, password, phone, role, employee_id },
    });
    if (error) {
      let msg = error.message || 'Failed to create staff account';
      try {
        const ctx = error.context;
        if (ctx && typeof ctx.json === 'function') {
          const json = await ctx.json();
          if (json?.error) msg = json.error;
        }
      } catch {
        // Keep Supabase's default error message.
      }
      throw new Error(msg);
    }
    return data?.staff;
  },

  /** Soft-terminate a staff member */
  terminateStaff: async (id) => {
    const { error } = await supabase
      .from('staff')
      .update({ is_terminated: true })
      .eq('id', id);
    if (error) throw error;
  },

  /** Re-activate a terminated staff member */
  reinstateStaff: async (id) => {
    const { error } = await supabase
      .from('staff')
      .update({ is_terminated: false })
      .eq('id', id);
    if (error) throw error;
  },
};

// ══════════════════════════════════════════════
// TRIPS
// ══════════════════════════════════════════════
export const tripService = {
  startTrip: async ({ busId, driverId, routeId, fromLocation, toLocation }) => {
    // End any existing active trip for this bus first
    await supabase
      .from('trips')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('bus_id', busId)
      .eq('status', 'active');

    // Mark bus as active
    await supabase
      .from('buses')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', busId);

    const basePayload = {
      bus_id:     busId,
      driver_id:  driverId,
      route_id:   routeId || null,
      status:     'active',
      started_at: new Date().toISOString(),
    };

    // Try with from/to location fields (requires migration 005)
    const fullPayload = { ...basePayload };
    if (fromLocation?.trim()) fullPayload.from_location = fromLocation.trim();
    if (toLocation?.trim())   fullPayload.to_location   = toLocation.trim();

    const { data, error } = await supabase
      .from('trips')
      .insert(fullPayload)
      .select()
      .single();

    // If from_location / to_location columns don't exist yet (migration 005 not run),
    // fall back to inserting without them so the trip still goes live.
    if (error) {
      const isSchemaError =
        error.message?.includes('from_location') ||
        error.message?.includes('to_location')   ||
        error.message?.includes('schema cache');

      if (isSchemaError && (fullPayload.from_location || fullPayload.to_location)) {
        console.warn('[tripService] from/to columns not in DB yet — retrying without them. Run migration 005.');
        const { data: data2, error: error2 } = await supabase
          .from('trips')
          .insert(basePayload)
          .select()
          .single();
        if (error2) throw error2;
        return data2;
      }
      throw error;
    }

    return data;
  },

  endTrip: async (tripId, busId) => {
    const { error } = await supabase
      .from('trips')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', tripId);
    if (error) throw error;

    if (busId) {
      await supabase
        .from('buses')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', busId);
    }
  },

  getActiveForDriver: async (driverId) => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, buses ( id, name, registration_no, route_id, capacity, routes ( id, name, color, origin, destination ) )')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getAllActive: async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, buses ( name, registration_no ), staff!driver_id ( full_name )')
      .eq('status', 'active')
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ══════════════════════════════════════════════
// LOCATIONS
// ══════════════════════════════════════════════
export const locationService = {
  push: async ({ tripId, lat, lng, speed = null, heading = null }) => {
    const { error } = await supabase
      .from('locations')
      .insert({
        trip_id:   tripId,
        lat,
        lng,
        speed,
        heading,
        timestamp: new Date().toISOString(),
      });
    if (error) console.warn('[LocationService] Push failed:', error.message);
  },
};

// ══════════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════
export const analyticsService = {
  localDateKey: (value) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /** Fleet-wide overview KPIs */
  getOverview: async () => {
    const [busRes, tripRes, ticketRes, reviewRes] = await Promise.allSettled([
      supabase.from('buses').select('id, status'),
      supabase.from('trips').select('id, status, started_at, ended_at'),
      supabase.from('tickets').select('id, status, booked_at'),
      supabase.from('reviews').select('id, rating'),
    ]);

    const buses   = busRes.status   === 'fulfilled' ? (busRes.value.data   || []) : [];
    const trips   = tripRes.status  === 'fulfilled' ? (tripRes.value.data  || []) : [];
    const tickets = ticketRes.status=== 'fulfilled' ? (ticketRes.value.data|| []) : [];
    const reviews = reviewRes.status=== 'fulfilled' ? (reviewRes.value.data|| []) : [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

    return {
      totalBuses:      buses.length,
      activeBuses:     buses.filter(b => b.status === 'active').length,
      maintenanceBuses:buses.filter(b => b.status === 'maintenance').length,
      inactiveBuses:   buses.filter(b => b.status === 'inactive').length,
      totalTrips:      trips.length,
      activeTrips:     trips.filter(t => t.status === 'active').length,
      completedTrips:  trips.filter(t => t.status === 'completed').length,
      tripsToday:      trips.filter(t => t.started_at >= todayStart).length,
      tripsThisWeek:   trips.filter(t => t.started_at >= weekStart).length,
      totalTickets:    tickets.length,
      ticketsToday:    tickets.filter(t => t.booked_at >= todayStart).length,
      usedTickets:     tickets.filter(t => t.status === 'used').length,
      avgRating,
      totalReviews:    reviews.length,
    };
  },

  /** Per-route trip breakdown */
  getRouteStats: async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('route_id, status, routes ( id, name, color, origin, destination )')
      .order('route_id');
    if (error) return [];

    const map = {};
    (data || []).forEach(t => {
      const id = t.route_id || 'unassigned';
      if (!map[id]) {
        map[id] = {
          id,
          name:        t.routes?.name        || 'Unassigned',
          color:       t.routes?.color       || '#667085',
          origin:      t.routes?.origin      || '',
          destination: t.routes?.destination || '',
          total: 0, active: 0, completed: 0,
        };
      }
      map[id].total++;
      if (t.status === 'active')    map[id].active++;
      if (t.status === 'completed') map[id].completed++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  },

  /** Per-bus trip history summary */
  getBusStats: async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('bus_id, status, started_at, ended_at, buses ( id, name, registration_no, status )')
      .order('started_at', { ascending: false });
    if (error) return [];

    const map = {};
    (data || []).forEach(t => {
      const id = t.bus_id;
      if (!map[id]) {
        map[id] = {
          id,
          name:           t.buses?.name            || 'Unknown',
          registration_no:t.buses?.registration_no || '',
          busStatus:      t.buses?.status          || 'inactive',
          totalTrips: 0, completedTrips: 0,
          totalMinutes: 0,
          lastTrip: null,
        };
      }
      map[id].totalTrips++;
      if (t.status === 'completed') {
        map[id].completedTrips++;
        if (t.started_at && t.ended_at) {
          const mins = (new Date(t.ended_at) - new Date(t.started_at)) / 60000;
          map[id].totalMinutes += Math.max(0, mins);
        }
      }
      if (!map[id].lastTrip || t.started_at > map[id].lastTrip) {
        map[id].lastTrip = t.started_at;
      }
    });
    return Object.values(map).sort((a, b) => b.totalTrips - a.totalTrips);
  },

  /** Recent 10 trips with bus + route info */
  getRecentTrips: async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('id, status, started_at, ended_at, buses ( name, registration_no ), routes ( name, color )')
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) return [];
    return data || [];
  },

  /**
   * Collection stats — sum of ticket amounts grouped by period.
   * period: 'day' | 'week' | 'month'
   * Returns array of { label, amount, count } for charting.
   */
  getCollectionStats: async (period = 'day') => {
    const now = new Date();
    let startDate;
    let buckets = [];
    const localDateKey = analyticsService.localDateKey;

    if (period === 'day') {
      // Last 7 days — bucket per day
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        buckets.push({
          label: i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' }),
          date:  localDateKey(d),
          amount: 0,
          count:  0,
        });
      }
    } else if (period === 'week') {
      // Last 8 weeks
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 55);
      startDate.setHours(0, 0, 0, 0);
      for (let i = 7; i >= 0; i--) {
        const wStart = new Date(now);
        wStart.setDate(now.getDate() - i * 7);
        buckets.push({
          label: `W${8 - i}`,
          weekStart: localDateKey(wStart),
          amount: 0,
          count:  0,
        });
      }
    } else {
      // Last 6 months
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 5);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          label: m.toLocaleDateString([], { month: 'short' }),
          month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
          amount: 0,
          count:  0,
        });
      }
    }

    const { data } = await supabase
      .from('tickets')
      .select('booked_at, amount, status')
      .gte('booked_at', startDate.toISOString())
      .neq('status', 'cancelled');

    (data || []).forEach(ticket => {
      const bookedDate = localDateKey(ticket.booked_at);
      const amt = parseFloat(ticket.amount) || 0;

      if (period === 'day') {
        const bucket = buckets.find(b => b.date === bookedDate);
        if (bucket) { bucket.amount += amt; bucket.count++; }
      } else if (period === 'week') {
        for (let i = buckets.length - 1; i >= 0; i--) {
          if (bookedDate >= buckets[i].weekStart) {
            buckets[i].amount += amt;
            buckets[i].count++;
            break;
          }
        }
      } else {
        const ticketMonth = bookedDate.slice(0, 7);
        const bucket = buckets.find(b => b.month === ticketMonth);
        if (bucket) { bucket.amount += amt; bucket.count++; }
      }
    });

    return buckets;
  },

  /** Today's total collection */
  getTodayCollection: async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('tickets')
      .select('amount')
      .gte('booked_at', todayStart.toISOString())
      .neq('status', 'cancelled');
    const total = (data || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const count = (data || []).length;
    return { total, count };
  },

  /** Top buses by total ticket collection */
  getTopBusesByCollection: async (limit = 3) => {
    const { data } = await supabase
      .from('tickets')
      .select('amount, trips ( bus_id, buses ( id, name, registration_no ) )')
      .neq('status', 'cancelled');

    const map = {};
    (data || []).forEach(t => {
      const bus = t.trips?.buses;
      if (!bus) return;
      if (!map[bus.id]) map[bus.id] = { ...bus, total: 0, count: 0 };
      map[bus.id].total += parseFloat(t.amount) || 0;
      map[bus.id].count++;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  },
};

export const ticketService = {
  getByQR: async (qrCode) => {
    try { await supabase.rpc('expire_stale_active_tickets'); } catch { /* best-effort sync */ }
    const code = String(qrCode || '').trim();
    const fetchByCode = (value) => supabase
      .from('tickets')
      .select(`
        *,
        users!passenger_id ( full_name ),
        routes ( name ),
        from_stop:stops!tickets_from_stop_id_fkey ( name ),
        to_stop:stops!tickets_to_stop_id_fkey ( name ),
        trips ( id, buses ( name ) )
      `)
      .eq('qr_code', value)
      .maybeSingle();

    let { data, error } = await fetchByCode(code);
    if (!data && !error && code.toLowerCase() !== code) {
      ({ data, error } = await fetchByCode(code.toLowerCase()));
    }
    if (error) return null;
    return data;
  },

  markUsed: async (ticketId) => {
    const validAfter = new Date(Date.now() - TICKET_VALIDITY_MS).toISOString();
    const { data, error } = await supabase
      .from('tickets')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', ticketId)
      .eq('status', 'active')
      .gte('booked_at', validAfter)
      .select('id, status, used_at')
      .maybeSingle(); // Only mark used if still active (prevents race condition)
    if (error) throw error;
    if (!data) throw new Error('Ticket is no longer active or has expired');
    return data;
  },
};

// ══════════════════════════════════════════════
// OPERATOR SETTINGS (UPI / Payment)
// ══════════════════════════════════════════════
export const settingsService = {
  /** Fetch the operator settings from app_settings key-value pairs */
  getSettings: async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['upi_id', 'upi_name', 'fare_note']);
      
      if (error) throw error;
      
      const settings = { upi_id: '', upi_name: 'BusLoop Operator', fare_note: '' };
      (data || []).forEach(row => {
        if (row.key === 'upi_id') settings.upi_id = row.value || '';
        if (row.key === 'upi_name') settings.upi_name = row.value || 'BusLoop Operator';
        if (row.key === 'fare_note') settings.fare_note = row.value || '';
      });
      return settings;
    } catch (err) {
      console.warn('[settingsService] app_settings fetch error:', err.message);
      return { upi_id: '', upi_name: 'BusLoop Operator', fare_note: '' };
    }
  },

  /** Save UPI settings by updating key-value rows in app_settings */
  saveUPI: async ({ upi_id, upi_name, fare_note }) => {
    const rows = [];
    if (upi_id !== undefined) rows.push({ key: 'upi_id', value: upi_id.trim(), updated_at: new Date().toISOString() });
    if (upi_name !== undefined) rows.push({ key: 'upi_name', value: upi_name.trim(), updated_at: new Date().toISOString() });
    if (fare_note !== undefined) rows.push({ key: 'fare_note', value: fare_note.trim(), updated_at: new Date().toISOString() });

    for (const row of rows) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: row.value, updated_at: row.updated_at })
        .eq('key', row.key);
      if (error) throw error;
    }

    return {
      upi_id: upi_id !== undefined ? upi_id.trim() : '',
      upi_name: upi_name !== undefined ? upi_name.trim() : 'BusLoop Operator',
      fare_note: fare_note !== undefined ? fare_note.trim() : '',
    };
  },
};
