// Mock data for BusLoop Staff App
export const MOCK_BUSES = [
  {
    id: '1',
    name: 'Bus 42',
    registration_no: 'MZ-01-AB-4200',
    route_id: '1',
    route_name: 'Route 1 — City Center → Airport',
    route_color: '#EF3E42',
    status: 'active',
    capacity: 50,
    current_passengers: 32,
    driver: 'Ravi Kumar',
    driver_id: 'd1',
    checker: 'Anand Sharma',
    lat: 13.0395,
    lng: 77.6240,
    trip_id: 'trip1',
  },
  {
    id: '2',
    name: 'Bus 17',
    registration_no: 'MZ-01-CD-1700',
    route_id: '2',
    route_name: 'Route 2 — University Loop',
    route_color: '#2563EB',
    status: 'delayed',
    capacity: 40,
    current_passengers: 18,
    driver: 'Anita Singh',
    driver_id: 'd2',
    checker: 'Priya M.',
    lat: 13.0420,
    lng: 77.6180,
    trip_id: 'trip2',
  },
  {
    id: '3',
    name: 'Bus 88',
    registration_no: 'MZ-01-EF-8800',
    route_id: null,
    route_name: 'Unassigned',
    route_color: '#667085',
    status: 'inactive',
    capacity: 60,
    current_passengers: 0,
    driver: null,
    driver_id: null,
    checker: null,
    lat: 13.0350,
    lng: 77.6300,
    trip_id: null,
  },
  {
    id: '4',
    name: 'Bus 5',
    registration_no: 'MZ-01-GH-0500',
    route_id: '1',
    route_name: 'Route 1 — City Center → Airport',
    route_color: '#EF3E42',
    status: 'maintenance',
    capacity: 50,
    current_passengers: 0,
    driver: null,
    driver_id: null,
    checker: null,
    lat: null,
    lng: null,
    trip_id: null,
  },
];

export const MOCK_ROUTES = [
  { id: '1', name: 'Route 1 — City Center → Airport', color: '#EF3E42', is_active: true, stops: 5 },
  { id: '2', name: 'Route 2 — University Loop', color: '#2563EB', is_active: true, stops: 4 },
  { id: '3', name: 'Route 3 — North-South Expressway', color: '#12B76A', is_active: true, stops: 3 },
];

export const MOCK_DRIVERS = [
  { id: 'd1', name: 'Ravi Kumar', phone: '+91 98765 00001', status: 'on_trip', assigned_bus: 'Bus 42' },
  { id: 'd2', name: 'Anita Singh', phone: '+91 98765 00002', status: 'on_trip', assigned_bus: 'Bus 17' },
  { id: 'd3', name: 'Suresh Rao', phone: '+91 98765 00003', status: 'available', assigned_bus: null },
  { id: 'd4', name: 'Mohammed Ali', phone: '+91 98765 00004', status: 'off_duty', assigned_bus: null },
];

export const MOCK_CHECKERS = [
  { id: 'c1', name: 'Anand Sharma', phone: '+91 98765 10001', status: 'on_duty', assigned_bus: 'Bus 42' },
  { id: 'c2', name: 'Priya M.', phone: '+91 98765 10002', status: 'on_duty', assigned_bus: 'Bus 17' },
  { id: 'c3', name: 'Divya L.', phone: '+91 98765 10003', status: 'off_duty', assigned_bus: null },
];

export const MOCK_TICKETS_TO_CHECK = [
  {
    id: 't1',
    qr_code: 'BL-2026-T001-A4B2',
    passenger: 'Joel Lalrinhlua',
    route: 'Route 1 — City Center → Airport',
    from: 'City Center',
    to: 'Airport Terminal',
    status: 'active',
    booked_at: '2026-04-11T10:30:00Z',
  },
  {
    id: 't2',
    qr_code: 'BL-2026-T002-C3D1',
    passenger: 'Rahul Tiwari',
    route: 'Route 2 — University Loop',
    from: 'Main Gate',
    to: 'Library Block',
    status: 'used',
    booked_at: '2026-04-10T08:15:00Z',
  },
];

export const STAFF_ROLES = {
  operator: {
    label: 'Bus Operator',
    desc: 'Manage buses, routes, and assignments',
    color: '#EF3E42',
    bg: '#FFFAF0',
    icon: '🚌',
  },
  driver: {
    label: 'Bus Driver',
    desc: 'Start trips and share live location',
    color: '#2563EB',
    bg: '#EBF8FF',
    icon: '🚗',
  },
  checker: {
    label: 'Bus Checker',
    desc: 'Verify and scan passenger tickets',
    color: '#12B76A',
    bg: 'var(--success-bg)',
    icon: '🛡️',
  },
};
