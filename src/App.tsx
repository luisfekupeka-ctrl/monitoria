import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Stock } from './pages/Stock';
import { Notebooks } from './pages/Notebooks';
import { Loans } from './pages/Loans';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import { AdminManagement } from './pages/AdminManagement';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sesi-blue"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/estoque" element={<PrivateRoute><Stock /></PrivateRoute>} />
          <Route path="/notebooks" element={<PrivateRoute><Notebooks /></PrivateRoute>} />
          <Route path="/emprestimos" element={<PrivateRoute><Loans /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><Users /></PrivateRoute>} />
          <Route path="/relatorios" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/gestao-acesso" element={
            <PrivateRoute>
              {user?.role === 'admin' ? <AdminManagement /> : <Navigate to="/" />}
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
