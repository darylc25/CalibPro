import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Equipment from './pages/Equipment.jsx';
import Schedule from './pages/Schedule.jsx';
import Staff from './pages/Staff.jsx';
import Export from './pages/Export.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
            </Routes>
          </main>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
