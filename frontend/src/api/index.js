const BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('calibpro_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem('calibpro_token');
    localStorage.removeItem('calibpro_user');
    window.location.href = '/';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.headers.get('content-type')?.includes('application/vnd.openxmlformats')) {
    return res.blob();
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export const api = {
  // Customers
  getCustomers: () => request('/customers'),
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (data) => request('/customers', { method: 'POST', body: data }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  // Equipment
  getEquipment: () => request('/equipment'),
  getEquipmentById: (id) => request(`/equipment/${id}`),
  createEquipment: (data) => request('/equipment', { method: 'POST', body: data }),
  updateEquipment: (id, data) => request(`/equipment/${id}`, { method: 'PUT', body: data }),
  deleteEquipment: (id) => request(`/equipment/${id}`, { method: 'DELETE' }),
  transferEquipment: (id, data) => request(`/equipment/${id}/transfer`, { method: 'POST', body: data }),
  batchTransferEquipment: (data) => request('/equipment/batch-transfer', { method: 'POST', body: data }),
  updateCustomerType: (id, customer_type) => request(`/customers/${id}/type`, { method: 'PATCH', body: { customer_type } }),

  // Calibrations
  getCalibrations: () => request('/calibrations'),
  getDueCalibrations: () => request('/calibrations/due'),
  getOverdueCalibrations: () => request('/calibrations/overdue'),
  createCalibration: (data) => request('/calibrations', { method: 'POST', body: data }),
  updateCalibration: (id, data) => request(`/calibrations/${id}`, { method: 'PUT', body: data }),
  deleteCalibration: (id) => request(`/calibrations/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardStats: (excludeDealers = false, exclude = []) => {
    const params = [];
    if (excludeDealers) params.push('excludeDealers=true');
    if (exclude.length) params.push('exclude=' + exclude.map(encodeURIComponent).join(','));
    return request(`/dashboard/stats${params.length ? '?' + params.join('&') : ''}`);
  },
  getPipelineStats: () => request('/pipeline/stats'),
  getMonthDetail: (month) => request(`/dashboard/month-detail?month=${month}`),
  getJobCodeCustomers: (code) => request(`/dashboard/jobcode-customers?code=${code}`),
  getEquipmentTypeDetail: (name) => request(`/dashboard/equipment-type-detail?name=${encodeURIComponent(name)}`),

  // Export
  exportMaster: () => request('/export/master'),
  exportSchedule: () => request('/export/schedule'),

  // Telegram
  telegramTest: () => request('/telegram/test'),
  telegramQuarterly: (year, quarter) => request('/telegram/quarterly', { method: 'POST', body: { year, quarter } }),

  // Email
  emailTest: () => request('/email/test'),
  emailQuarterly: (year, quarter, recipients) => request('/email/quarterly', { method: 'POST', body: { year, quarter, recipients } }),

  // Staff
  getStaff: () => request('/staff'),
  createStaff: (data) => request('/staff', { method: 'POST', body: data }),
  updateStaff: (id, data) => request(`/staff/${id}`, { method: 'PUT', body: data }),
  deleteStaff: (id) => request(`/staff/${id}`, { method: 'DELETE' }),

  // Users (admin only)
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Audit log (admin only)
  getAuditLogs: (query = '') => request(`/audit${query ? '?' + query : ''}`),

  // Profile
  getProfile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: data }),

  // Change own password
  changePassword: (data) => request('/auth/change-password', { method: 'POST', body: data }),
  updateHint: (password_hint) => request('/auth/hint', { method: 'PUT', body: { password_hint } }),

  // Get password hint (public — no auth needed)
  getPasswordHint: (username) => request(`/auth/hint?username=${encodeURIComponent(username)}`),

  // Admin reset any user's password
  resetUserPassword: (id, data) => request(`/auth/users/${id}/reset-password`, { method: 'POST', body: data }),

  // Contracts
  getContracts: () => request('/contracts'),
  getContract: (id) => request(`/contracts/${id}`),
  createContract: (data) => request('/contracts', { method: 'POST', body: data }),
  updateContractStatus: (id, status) => request(`/contracts/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteContract: (id) => request(`/contracts/${id}`, { method: 'DELETE' }),
  validateContract: (contractNumber) => request(`/contracts/validate/${encodeURIComponent(contractNumber)}`),
  downloadContract: (id) => request(`/contracts/${id}/download`),

  // Delete requests
  createDeleteRequest: (data) => request('/delete-requests', { method: 'POST', body: data }),
  getDeleteRequests: () => request('/delete-requests'),
  getPendingDeleteCount: () => request('/delete-requests/pending-count'),
  reviewDeleteRequest: (id, data) => request(`/delete-requests/${id}`, { method: 'PUT', body: data }),
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getPriority(nextCal) {
  if (!nextCal) return 'unknown';
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().split('T')[0];
  if (nextCal < today) return 'overdue';
  if (nextCal <= soonStr) return 'due_soon';
  return 'scheduled';
}

// 'active' = still under warranty, 'expired' = past end date, null = no warranty data
export function getWarrantyStatus(endOfWarranty) {
  if (!endOfWarranty) return null;
  const today = new Date().toISOString().split('T')[0];
  return endOfWarranty >= today ? 'active' : 'expired';
}

export const WARRANTY_BADGE = {
  active:  { label: 'In Warranty', cls: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired',     cls: 'bg-gray-100 text-gray-500' },
};

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function daysDiff(dateStr) {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}
