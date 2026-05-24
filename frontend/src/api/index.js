const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.headers.get('content-type')?.includes('application/vnd.openxmlformats')) {
    return res.blob();
  }
  return res.json();
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

  // Calibrations
  getCalibrations: () => request('/calibrations'),
  getDueCalibrations: () => request('/calibrations/due'),
  getOverdueCalibrations: () => request('/calibrations/overdue'),
  createCalibration: (data) => request('/calibrations', { method: 'POST', body: data }),
  updateCalibration: (id, data) => request(`/calibrations/${id}`, { method: 'PUT', body: data }),
  deleteCalibration: (id) => request(`/calibrations/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

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

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysDiff(dateStr) {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}
