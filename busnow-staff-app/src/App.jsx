import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { StaffAuthProvider, useStaffAuth } from './context/StaffAuthContext';
import RoleSelectPage    from './pages/RoleSelectPage';
import StaffLoginPage    from './pages/StaffLoginPage';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import DriverDashboard   from './pages/driver/DriverDashboard';
import CheckerDashboard  from './pages/checker/CheckerDashboard';

// Role-to-allowed-DB-roles mapping
const ROLE_ACCESS = {
  operator: ['operator', 'super_admin'],
  driver:   ['driver',   'super_admin'],
  checker:  ['checker',  'operator', 'super_admin'],
};

function ProtectedRoute({ requiredRole, children }) {
  const { user, profile, loading } = useStaffAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  // Not logged in
  if (!user) return <Navigate to={`/login/${requiredRole}`} replace />;

  // Profile loaded but role not permitted
  if (profile && ROLE_ACCESS[requiredRole] && !ROLE_ACCESS[requiredRole].includes(profile.role)) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'var(--bg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2 style={{ marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Your account ({profile.role}) does not have access to the {requiredRole} dashboard.
        </p>
        <a href="/" style={{ color: 'var(--brand)', fontWeight: 600 }}>← Go back</a>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <StaffAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                    element={<RoleSelectPage />} />
          <Route path="/login/:role"         element={<StaffLoginPage />} />
          <Route path="/dashboard/operator"  element={
            <ProtectedRoute requiredRole="operator">
              <OperatorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/driver"    element={
            <ProtectedRoute requiredRole="driver">
              <DriverDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/checker"   element={
            <ProtectedRoute requiredRole="checker">
              <CheckerDashboard />
            </ProtectedRoute>
          } />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StaffAuthProvider>
  );
}
