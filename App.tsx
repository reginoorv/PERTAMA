import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { DebtPage } from './pages/Debt';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: string[] }> = ({ children, roles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/pos" replace />; // Redirect unauthorized to POS (safest default)
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/pos" element={
            <ProtectedRoute roles={['admin', 'cashier']}>
              <POS />
            </ProtectedRoute>
          } />
          
          <Route path="/products" element={
            <ProtectedRoute roles={['admin']}>
              <Products />
            </ProtectedRoute>
          } />
          
          <Route path="/customers" element={
            <ProtectedRoute roles={['admin']}>
              <Customers />
            </ProtectedRoute>
          } />
          
          <Route path="/debt" element={
            <ProtectedRoute roles={['admin']}>
              <DebtPage />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute roles={['admin']}>
              <Reports />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute roles={['admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
