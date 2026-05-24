import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

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
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-white/60 hover:text-white transition-colors p-1 rounded"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {NAV.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'}`
            }
          >
            <span className="text-lg flex-shrink-0">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        {!collapsed && (
          <p className="text-white/30 text-xs">© 2025 CalibPro</p>
        )}
      </div>
    </aside>
  );
}
