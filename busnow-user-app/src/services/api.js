import { supabase } from '../lib/supabase';
import { withTicketValidity } from '../utils/ticketValidity';

// BUSES
export const busService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('buses')
      .select('*, routes ( id, name, color, origin, destination, landmarks, search_keywords, base_fare )')
      .order('name');
    if (error) throw error;
    return data.map(bus => ({
      ...bus,
      route_name:        bus.routes?.name            ?? 'Unassigned',
      route_color:       bus.routes?.color           ?? '#667085',
      route_origin:      bus.routes?.origin          ?? null,
      route_destination: bus.routes?.destination     ?? null,
      route_landmarks:   bus.routes?.landmarks       ?? null,
      route_keywords:    bus.routes?.search_keywords ?? null,
      base_fare:         bus.routes?.base_fare       ?? 30,
    }));
  },


  getById: async (id) => {
    const { data, error } = await supabase
      .from('buses')
      .select('*, routes ( id, name, color, origin, destination, landmarks, notes, search_keywords, base_fare )')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      route_name:        data.routes?.name            ?? 'Unassigned',
      route_color:       data.routes?.color           ?? '#667085',
      route_origin:      data.routes?.origin          ?? null,
      route_destination: data.routes?.destination     ?? null,
      route_landmarks:   data.routes?.landmarks       ?? null,
      route_notes:       data.routes?.notes           ?? null,
      route_keywords:    data.routes?.search_keywords ?? null,
      base_fare:         data.routes?.base_fare       ?? 30,
    };
  },

  getActive: async () => {
    const { data, error } = await supabase
      .from('buses')
      .select('*, routes ( id, name, color, base_fare )')
      .in('status', ['active', 'delayed']);
    if (error) throw error;
    return data.map(bus => ({
      ...bus,
      route_name:  bus.routes?.name  ?? 'Unassigned',
      route_color: bus.routes?.color ?? '#667085',
      base_fare:   bus.routes?.base_fare ?? 30,
    }));
  },
};

// ROUTES
export const routeService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  getStops: async (routeId) => {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('route_id', routeId)
      .order('stop_order');
    if (error) throw error;
    return data;
  },
};

// TRIPS
export const tripService = {
  getById: async (tripId) => {
    const { data, error } = await supabase
      .from('trips')
      .select('id, bus_id, status, buses ( id, name, registration_no )')
      .eq('id', tripId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getActiveForBus: async (busId) => {
    // drivers are stored in public.staff — join that table, not public.users
    const { data, error } = await supabase
      .from('trips')
      .select('id, bus_id, driver_id, status, started_at, from_location, to_location, staff!driver_id ( full_name )')
      .eq('bus_id', busId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

// LOCATIONS (Realtime)
export const locationService = {
  getLatest: async (tripId) => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('trip_id', tripId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  subscribe: (tripId, callback) => {
    const channel = supabase
      .channel(`locations:trip:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => callback(payload.new)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  subscribeBuses: (callback) => {
    const channel = supabase
      .channel('bus_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, (payload) => callback(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // Subscribe to trip status changes (e.g. trip ends → reload active buses)
  subscribeTrips: (callback) => {
    const channel = supabase
      .channel('trip_status_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => callback(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// TICKETS
export const ticketService = {
  getMyTickets: async (userId) => {
    try { await supabase.rpc('expire_stale_active_tickets'); } catch { /* best-effort sync */ }
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        routes ( name ),
        from_stop:stops!tickets_from_stop_id_fkey ( name ),
        to_stop:stops!tickets_to_stop_id_fkey ( name ),
        trips ( id, bus_id, buses ( name, registration_no ) )
      `)
      .eq('passenger_id', userId)
      .order('booked_at', { ascending: false });
    if (error) throw error;
    return data.map(t => withTicketValidity({
      ...t,
      amount_paid:   t.amount,
      route_name:    t.routes?.name            ?? 'Unknown Route',
      bus_name:      t.trips?.buses?.name       ?? 'Unknown Bus',
      bus_id:         t.trips?.bus_id           ?? null,
      from_stop_name: t.from_stop?.name        ?? null,
      to_stop_name:   t.to_stop?.name          ?? null,
    }));
  },

  create: async () => {
    throw new Error('Tickets must be created through verified Razorpay payment.');
  },
};

// REVIEWS
export const reviewService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, users!passenger_id ( full_name ), buses ( name )')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(r => ({
      ...r,
      passenger: r.users?.full_name ?? 'Anonymous',
      bus_name:  r.buses?.name     ?? 'Unknown Bus',
    }));
  },

  insert: async ({ passengerId, busId, tripId, rating, comment }) => {
    const { data, error } = await supabase
      .from('reviews')
      .insert({ passenger_id: passengerId, bus_id: busId, trip_id: tripId || null, rating, comment })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// OPERATOR SETTINGS (UPI — read-only for users)
export const settingsService = {
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
};
