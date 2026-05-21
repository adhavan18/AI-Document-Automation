import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import useAppStore from './store/useAppStore.js';
import { authApi } from './api/auth.js';

export default function App() {
  const user = useAppStore(s => s.user);
  const setAuth = useAppStore(s => s.setAuth);
  const clearAuth = useAppStore(s => s.clearAuth);

  useEffect(() => {
    const token = localStorage.getItem('mosaic_token');
    if (token && !user) {
      authApi.me()
        .then(u => setAuth(u, token))
        .catch(() => clearAuth());
    }
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={user ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
