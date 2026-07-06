import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage     from './pages/LoginPage';
import HomePage      from './pages/HomePage';
import SearchPage    from './pages/SearchPage';
import BusDetailPage from './pages/BusDetailPage';
import ReviewsPage   from './pages/ReviewsPage';
import TicketsPage   from './pages/TicketsPage';
import ProfilePage   from './pages/ProfilePage';

const QRPage = lazy(() => import('./pages/QRPage'));

function PageLoader() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );
}

/** Redirect to /login if not authenticated */
function AuthRequired({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login"   element={<LoginPage />} />

          {/* Protected routes */}
          <Route path="/"        element={<AuthRequired><HomePage /></AuthRequired>} />
          <Route path="/search"  element={<AuthRequired><SearchPage /></AuthRequired>} />
          <Route path="/bus/:id" element={<AuthRequired><BusDetailPage /></AuthRequired>} />
          <Route path="/reviews" element={<AuthRequired><ReviewsPage /></AuthRequired>} />
          <Route path="/qr"      element={<AuthRequired><Suspense fallback={<PageLoader />}><QRPage /></Suspense></AuthRequired>} />
          <Route path="/tickets" element={<AuthRequired><TicketsPage /></AuthRequired>} />
          <Route path="/profile" element={<AuthRequired><ProfilePage /></AuthRequired>} />

          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
