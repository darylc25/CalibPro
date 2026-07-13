import React from 'react';

// Searchable, single-select customer picker used by transfer modals.
// Filtering is internal so callers just pass the raw customer list + search string.
export default function CustomerSelectList({ customers, loading, search, selected, onSelect, maxHeight = 220 }) {
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !search || c.name.toLowerCase().includes(q) || (c.state || '').toLowerCase().includes(q);
  });

  return (
    <div className="border border-gray-200 rounded-lg overflow-y-auto" style={{ maxHeight }}>
      {loading ? (
        <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">No customers found</div>
      ) : filtered.map(c => (
        <button key={c.id} onClick={() => onSelect(c)}
          className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 hover:bg-blue-50 flex items-center gap-2 transition-colors
            ${selected?.id === c.id ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-700'}`}>
          {selected?.id === c.id && <span className="text-blue-500">✓</span>}
          <span className="flex-1">{c.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.customer_type === 'Dealer' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
            {c.customer_type || 'Direct'}
          </span>
          <span className="text-xs text-gray-400">{c.state}</span>
        </button>
      ))}
    </div>
  );
}
