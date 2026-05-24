import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/customers', label: 'Customers', icon: '🏥' },
  { to: '/equipment', label: 'Equipment', icon: '🔧' },
  { to: '/schedule', label: 'Schedule', icon: '📅' },
  { to: '/staff', label: 'Staff', icon: '👷' },
  { to: '/export', label: 'Export', icon: '📤' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  return (
    <aside
      className={`flex-shrink-0 flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ background: '#0D2847', minHeight: '100vh' }}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-base leading-tight">CalibPro</p>
            <p className="text-blue-300 text-xs">Calibration Manager</p>
          </div>
        )}
        <button onClick={() => setCollapsed(c => !c)} className="text-white/60 hover:text-white transition-colors p-1 rounded">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {NAV.map(({ to, label, icon, exact }) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
            <span className="text-lg flex-shrink-0">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/users"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
            <span className="text-lg flex-shrink-0">👥</span>
            {!collapsed && <span>Users</span>}
          </NavLink>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.name || user.username}</p>
              <p className="text-white/40 text-xs">{user.role === 'admin' ? '👑 Admin' : '👤 User'}</p>
            </div>
          </div>
        )}
        <button onClick={logout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}>
          <span className="flex-shrink-0">🚪</span>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
