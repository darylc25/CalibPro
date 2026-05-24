import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Equipment from './pages/Equipment.jsx';
import Schedule from './pages/Schedule.jsx';
import Staff from './pages/Staff.jsx';
import Export from './pages/Export.jsx';
import Users from './pages/Users.jsx';

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  );

  if (!user) return <Login />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/export" element={<Export />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
