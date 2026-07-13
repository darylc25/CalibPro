import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('calibpro_token');
    const saved = localStorage.getItem('calibpro_user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    const mcp = localStorage.getItem('calibpro_must_change_pw');
    if (mcp === '1') setMustChangePassword(true);
    setLoading(false);
  }, []);

  function login(token, userData, forceChange = false) {
    localStorage.setItem('calibpro_token', token);
    localStorage.setItem('calibpro_user', JSON.stringify(userData));
    localStorage.setItem('calibpro_must_change_pw', forceChange ? '1' : '0');
    setUser(userData);
    setMustChangePassword(forceChange);
  }

  function clearMustChangePassword() {
    localStorage.setItem('calibpro_must_change_pw', '0');
    setMustChangePassword(false);
  }

  function logout() {
    localStorage.removeItem('calibpro_token');
    localStorage.removeItem('calibpro_user');
    localStorage.removeItem('calibpro_must_change_pw');
    setUser(null);
    setMustChangePassword(false);
  }

  // Accept both old role names (admin/editor) and new (administrator/engineer/admin_assist)
  const role = user?.role;
  const isAdmin = role === 'administrator' || role === 'admin';
  const perms   = user?.permissions || {};

  // Individual permission flags — administrator always gets all
  // Also grant full permissions to old 'admin' / 'editor' roles for backward compat
  const legacyEdit = role === 'editor';
  const canEdit       = isAdmin || legacyEdit || !!perms.can_edit;
  const canDelete     = isAdmin || !!perms.can_delete;
  const canAudit      = isAdmin || !!perms.can_audit;
  const canSendReport = isAdmin || !!perms.can_send_report;

  // Backward-compat alias
  const isEditor = canEdit;

  return (
    <AuthContext.Provider value={{
      user, isAdmin, isEditor,
      canEdit, canDelete, canAudit, canSendReport,
      loading, login, logout, mustChangePassword, clearMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
