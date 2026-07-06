// Mock data for BusLoop User App
export const MOCK_ROUTES = [
  { id: '1', name: 'Route 1 — City Center → Airport', color: '#EF3E42', is_active: true },
  { id: '2', name: 'Route 2 — University Loop', color: '#2563EB', is_active: true },
  { id: '3', name: 'Route 3 — North-South Expressway', color: '#12B76A', is_active: false },
];

export const MOCK_BUSES = [
  {
    id: '1', name: 'Bus 42', registration_no: 'MZ-01-AB-4200',
    route_id: '1', route_name: 'Route 1 — City Center → Airport',
    route_color: '#EF3E42', status: 'active', capacity: 50,
    current_passengers: 32, eta_minutes: 5,
    last_stop: 'Nagaraesh Lake', next_stop: 'Hennur Basavur Road',
    driver: 'Ravi Kumar', lat: 13.0395, lng: 77.6240,
    route_origin: 'City Center', route_destination: 'Airport Terminal',
    route_landmarks: 'Nagaraesh Lake, Hennur Basavur Road',
    route_notes: 'Express route — limited stops between Kannuru and Airport',
    route_keywords: 'airport shuttle city center terminal',
  },
  {
    id: '2', name: 'Bus 17', registration_no: 'MZ-01-CD-1700',
    route_id: '2', route_name: 'Route 2 — University Loop',
    route_color: '#2563EB', status: 'active', capacity: 40,
    current_passengers: 18, eta_minutes: 12,
    last_stop: 'Main Gate', next_stop: 'Library Block',
    driver: 'Anita Singh', lat: 13.0420, lng: 77.6180,
    route_origin: 'Main Gate', route_destination: 'Main Gate',
    route_landmarks: 'Library Block, Sports Complex',
    route_notes: 'Circular route — runs every 15 minutes on weekdays',
    route_keywords: 'university campus library hostel',
  },
  {
    id: '3', name: 'Bus 88', registration_no: 'MZ-01-EF-8800',
    route_id: '3', route_name: 'Route 3 — North-South Expressway',
    route_color: '#12B76A', status: 'inactive', capacity: 60,
    current_passengers: 0, eta_minutes: null,
    last_stop: null, next_stop: null,
    driver: 'Suresh Rao', lat: 13.0350, lng: 77.6300,
    route_origin: 'North Terminal', route_destination: 'South Terminal',
    route_landmarks: 'Central Park, City Mall',
    route_notes: 'Limited stops — only at designated express stops',
    route_keywords: 'express north south',
  },
  {
    id: '4', name: 'Bus 5', registration_no: 'MZ-01-GH-0500',
    route_id: '1', route_name: 'Route 1 — City Center → Airport',
    route_color: '#EF3E42', status: 'delayed', capacity: 50,
    current_passengers: 41, eta_minutes: 18,
    last_stop: 'Kannuru Junction', next_stop: 'Nagaraesh Lake',
    driver: 'Mohammed Ali', lat: 13.0480, lng: 77.6150,
    route_origin: 'City Center', route_destination: 'Airport Terminal',
    route_landmarks: 'Nagaraesh Lake, Hennur Basavur Road',
    route_notes: 'Express route — limited stops between Kannuru and Airport',
    route_keywords: 'airport shuttle city center terminal',
  },
];


export const MOCK_STOPS = {
  '1': [
    { id: 's1', name: 'City Center', stop_order: 1, lat: 13.0550, lng: 77.6100 },
    { id: 's2', name: 'Kannuru Junction', stop_order: 2, lat: 13.0480, lng: 77.6150 },
    { id: 's3', name: 'Nagaraesh Lake', stop_order: 3, lat: 13.0420, lng: 77.6200 },
    { id: 's4', name: 'Hennur Basavur Road', stop_order: 4, lat: 13.0395, lng: 77.6240 },
    { id: 's5', name: 'Airport Terminal', stop_order: 5, lat: 13.0200, lng: 77.6350 },
  ],
  '2': [
    { id: 's6', name: 'Main Gate', stop_order: 1, lat: 13.0420, lng: 77.6180 },
    { id: 's7', name: 'Library Block', stop_order: 2, lat: 13.0430, lng: 77.6160 },
    { id: 's8', name: 'Hostel Block', stop_order: 3, lat: 13.0440, lng: 77.6140 },
    { id: 's9', name: 'Sports Complex', stop_order: 4, lat: 13.0450, lng: 77.6130 },
  ],
  '3': [
    { id: 's10', name: 'North Terminal', stop_order: 1, lat: 13.0600, lng: 77.6050 },
    { id: 's11', name: 'Central Hub', stop_order: 2, lat: 13.0500, lng: 77.6100 },
    { id: 's12', name: 'South Market', stop_order: 3, lat: 13.0350, lng: 77.6300 },
  ],
};

export const MOCK_TICKETS = [
  {
    id: 't1',
    bus_name: 'Bus 42',
    route_name: 'Route 1 — City Center → Airport',
    from_stop: 'City Center',
    to_stop: 'Airport Terminal',
    status: 'active',
    booked_at: '2026-04-11T10:30:00Z',
    qr_code: 'BL-2026-T001-A4B2',
  },
  {
    id: 't2',
    bus_name: 'Bus 17',
    route_name: 'Route 2 — University Loop',
    from_stop: 'Main Gate',
    to_stop: 'Library Block',
    status: 'used',
    booked_at: '2026-04-10T08:15:00Z',
    qr_code: 'BL-2026-T002-C3D1',
  },
  {
    id: 't3',
    bus_name: 'Bus 42',
    route_name: 'Route 1 — City Center → Airport',
    from_stop: 'Nagaraesh Lake',
    to_stop: 'Airport Terminal',
    status: 'expired',
    booked_at: '2026-04-09T14:00:00Z',
    qr_code: 'BL-2026-T003-E5F6',
  },
];

export const MOCK_REVIEWS = [
  {
    id: 'r1',
    bus_name: 'Bus 42',
    passenger: 'Priya M.',
    avatar: 'P',
    rating: 5,
    comment: 'Super punctual and always on time! Driver is very courteous.',
    created_at: '2026-04-10T12:00:00Z',
  },
  {
    id: 'r2',
    bus_name: 'Bus 17',
    passenger: 'Arjun K.',
    avatar: 'A',
    rating: 4,
    comment: 'Good service. Air conditioning could be better on hot days.',
    created_at: '2026-04-09T09:30:00Z',
  },
  {
    id: 'r3',
    bus_name: 'Bus 5',
    passenger: 'Sneha R.',
    avatar: 'S',
    rating: 3,
    comment: 'Was delayed by about 15 minutes today. Otherwise fine.',
    created_at: '2026-04-08T17:45:00Z',
  },
  {
    id: 'r4',
    bus_name: 'Bus 42',
    passenger: 'Rahul T.',
    avatar: 'R',
    rating: 5,
    comment: 'Love the real-time tracking! Makes planning my commute so much easier.',
    created_at: '2026-04-07T08:00:00Z',
  },
  {
    id: 'r5',
    bus_name: 'Bus 88',
    passenger: 'Divya L.',
    avatar: 'D',
    rating: 2,
    comment: 'Bus was overcrowded and AC was not working. Needs improvement.',
    created_at: '2026-04-06T16:20:00Z',
  },
];

export const MOCK_USER = {
  id: 'u1',
  full_name: 'Joel Lalrinhlua',
  email: 'joel@busnow.app',
  role: 'passenger',
  phone: '+91 98765 43210',
  avatar: 'J',
};
