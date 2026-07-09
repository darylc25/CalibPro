import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDealers } from '../context/DealerContext.jsx';
import { api } from '../api/index.js';
import DiatecLogo from './DiatecLogo.jsx';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: '📊', exact: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/customers', label: 'Customers', icon: '🏥' },
      { to: '/equipment', label: 'Equipment', icon: '🔧' },
      { to: '/jobs', label: 'Jobs', icon: '📋' },
      { to: '/schedule', label: 'Schedule', icon: '📅' },
      { to: '/contracts', label: 'Contracts', icon: '📄' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/pipeline', label: 'Pipeline', icon: '🎯' },
    ],
  },
  {
    label: 'Report',
    items: [
      { to: '/export', label: 'Export', icon: '📤' },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDelCount, setPendingDelCount] = useState(0);
  const { user, isAdmin, canAudit, logout } = useAuth();
  const { showDealers, toggle: toggleDealers } = useDealers();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) return;
    function fetchCount() {
      api.getPendingDeleteCount().then(r => setPendingDelCount(r.count || 0)).catch(() => {});
    }
    fetchCount();
    const t = setInterval(fetchCount, 60000); // refresh every minute
    return () => clearInterval(t);
  }, [isAdmin]);

  return (
    <aside
      className={`flex-shrink-0 flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ background: '#4A86C8', minHeight: '100vh' }}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        {!collapsed && (
          <img src="/diatec-logo.png" alt="Diatec" style={{ height: '40px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
        )}
        <button onClick={() => setCollapsed(c => !c)} className="text-white/60 hover:text-white transition-colors p-1 rounded">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold px-3 mt-3 mb-1">{group.label}</p>
            )}
            {collapsed && <div className="border-t border-white/10 my-2" />}
            {group.items.map(({ to, label, icon, exact }) => (
              <NavLink key={to} to={to} end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                <span className="text-lg flex-shrink-0">{icon}</span>
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        {(isAdmin || canAudit) && (
          <div className="mb-1">
            {!collapsed && (
              <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold px-3 mt-3 mb-1">Administration</p>
            )}
            {collapsed && <div className="border-t border-white/10 my-2" />}
            <NavLink to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-lg flex-shrink-0">👷</span>
              {!collapsed && <span>Staff</span>}
            </NavLink>
            {isAdmin && (
              <NavLink to="/delete-requests"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                <span className="text-lg flex-shrink-0">🗑️</span>
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    Delete Requests
                    {pendingDelCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {pendingDelCount}
                      </span>
                    )}
                  </span>
                )}
                {collapsed && pendingDelCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '9px' }}>
                    {pendingDelCount}
                  </span>
                )}
              </NavLink>
            )}
            {canAudit && (
              <NavLink to="/audit"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                <span className="text-lg flex-shrink-0">📋</span>
                {!collapsed && <span>Audit Log</span>}
              </NavLink>
            )}
          </div>
        )}

        {/* Dealer visibility toggle — inside nav so it's always visible */}
        <div className="mt-2 pt-2 border-t border-white/10">
          <button
            onClick={toggleDealers}
            title={showDealers ? 'Switch to Direct Sales only' : 'Switch to show all accounts'}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${showDealers
                ? 'bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <span className="text-lg flex-shrink-0">{showDealers ? '👁' : '🏢'}</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sm font-medium">
                  {showDealers ? 'All Accounts' : 'Direct Only'}
                </span>
                <span className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors flex items-center px-0.5
                  ${showDealers ? 'bg-amber-400' : 'bg-white/30'}`}>
                  <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${showDealers ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </>
            )}
          </button>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {user && (
          <button onClick={() => navigate('/profile')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name || user.username).charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-medium truncate">{user.name || user.username}</p>
                <p className="text-white/40 text-xs">
                  {user.role === 'administrator' || user.role === 'admin' ? '👑 Administrator'
                    : user.role === 'engineer' ? '🔧 Engineer'
                    : user.role === 'admin_assist' ? '🗂️ Admin Assist'
                    : '👁 Viewer'}
                </p>
              </div>
            )}
            {!collapsed && <span className="text-white/30 text-xs flex-shrink-0">›</span>}
          </button>
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
